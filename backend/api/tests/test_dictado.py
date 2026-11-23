import json
import os
from unittest import mock

import requests
from django.test import override_settings

from api import dictado

from .base import PruebaAPI


class RespuestaIA:
    def __init__(self, contenido, status=200):
        self.status_code = status
        self._contenido = contenido

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError(str(self.status_code))

    def json(self):
        return {'choices': [{'message': {'content': self._contenido}}]}


GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
# como quedan IA_1_* (Groq, 2 modelos) e IA_2_* (Gemini, sin reasoning) despues de leerlos en settings.py
PROVEEDORES = [
    {'nombre': 'IA_1', 'url': 'https://api.groq.com/openai', 'clave': 'clave-groq', 'modelos': ['groq-20b', 'groq-120b'], 'reasoning': 'low'},
    {'nombre': 'IA_2', 'url': GEMINI, 'clave': 'clave-gemini', 'modelos': ['gemini-lite'], 'reasoning': ''},
]
ARROZ = json.dumps([{'tipo': 'ingreso', 'producto': 'Arroz', 'cantidad': 2, 'unidad': 'kg', 'vence': None}])


@override_settings(IA_PROVEEDORES=PROVEEDORES)
class DictadoTests(PruebaAPI):
    def dictar(self, texto='dos kilos de arroz'):
        return self.client.post('/api/dictado/', {'texto': texto}, format='json')

    def dictar_con(self, *respuestas):
        """Dicta con la IA respondiendo en orden lo dado (una RespuestaIA o una excepcion por intento)."""
        self.entrar_como(self.usuario)
        with mock.patch.object(dictado.requests, 'post', side_effect=list(respuestas)) as post:
            r = self.dictar()
        # (url, clave, modelo) de cada intento
        intentos = [(c.args[0], c.kwargs['headers'].get('Authorization'), c.kwargs['json']['model']) for c in post.call_args_list]
        return r, intentos, post

    def test_pide_sesion(self):
        self.assertEqual(self.dictar().status_code, 401)

    @override_settings(IA_PROVEEDORES=[])
    def test_sin_configurar_responde_503(self):
        self.entrar_como(self.usuario)
        self.assertEqual(self.dictar().status_code, 503)

    def test_la_clave_va_al_servidor_y_no_el_token_de_la_app(self):
        r, intentos, post = self.dictar_con(RespuestaIA(ARROZ))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['items'], [{'tipo': 'ingreso', 'producto': 'Arroz', 'cantidad': 2, 'unidad': 'kg', 'vence': None}])
        self.assertEqual(intentos, [('https://api.groq.com/openai/v1/chat/completions', 'Bearer clave-groq', 'groq-20b')])
        self.assertEqual(post.call_args.kwargs['json']['reasoning_effort'], 'low')

    def test_si_un_modelo_falla_prueba_el_siguiente(self):
        # limite de Groq en el 20b, el 120b caido: responde Gemini
        r, intentos, post = self.dictar_con(RespuestaIA('', status=429), RespuestaIA('', status=500), RespuestaIA(ARROZ))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['items'][0]['producto'], 'Arroz')
        self.assertEqual([m for _, _, m in intentos], ['groq-20b', 'groq-120b', 'gemini-lite'])
        self.assertEqual(intentos[2][:2], (GEMINI, 'Bearer clave-gemini'))
        # Gemini sin IA_2_REASONING: no se manda
        self.assertNotIn('reasoning_effort', post.call_args.kwargs['json'])

    def test_lento_caido_o_vacio_tambien_pasa_al_siguiente(self):
        r, intentos, _ = self.dictar_con(requests.exceptions.Timeout(), RespuestaIA(None), RespuestaIA(ARROZ))
        self.assertEqual((r.status_code, len(intentos)), (200, 3))
        r, intentos, _ = self.dictar_con(requests.exceptions.ConnectionError(), RespuestaIA('no es json valido'))
        # lo que responde se limpia: si no es una lista de productos, no trae nada (pero si respondio)
        self.assertEqual((r.status_code, r.data['items'], len(intentos)), (200, [], 2))

    def test_clave_rechazada_salta_los_otros_modelos_de_ese_proveedor(self):
        r, intentos, _ = self.dictar_con(RespuestaIA('', status=401), RespuestaIA(ARROZ))
        self.assertEqual(r.status_code, 200)
        self.assertEqual([m for _, _, m in intentos], ['groq-20b', 'gemini-lite'])

    def test_si_ninguno_responde_usa_el_local(self):
        r, intentos, _ = self.dictar_con(RespuestaIA('', status=429), RespuestaIA('', status=429), RespuestaIA('', status=503))
        self.assertEqual((r.status_code, len(intentos)), (503, 3))

    def test_direccion_de_cada_proveedor(self):
        # Groq y OmniRoute: se agrega la ruta; Gemini: la direccion completa se usa tal cual
        self.assertEqual(dictado.url_chat('http://localhost:20128'), 'http://localhost:20128/v1/chat/completions')
        self.assertEqual(dictado.url_chat('https://api.groq.com/openai/'), 'https://api.groq.com/openai/v1/chat/completions')
        self.assertEqual(dictado.url_chat(GEMINI), GEMINI)
        self.assertEqual(dictado.url_chat(GEMINI + '/'), GEMINI)

    def test_respuesta_vacia_o_con_razonamiento(self):
        self.assertEqual(dictado.limpiar_items(None), [])
        self.assertEqual(dictado.limpiar_items('<think>el usuario dice arroz</think>\n[{"producto": "Arroz", "cantidad": 2}]'),
                         [{'tipo': None, 'producto': 'Arroz', 'cantidad': 2, 'unidad': '', 'vence': None}])

    def test_limpia_lo_que_devuelve_la_ia(self):
        self.assertEqual(dictado.limpiar_items('no es json'), [])
        self.assertEqual(dictado.limpiar_items('```json\n{"producto": "Leche", "cantidad": "tres"}\n```'),
                         [{'tipo': None, 'producto': 'Leche', 'cantidad': None, 'unidad': '', 'vence': None}])
        items = dictado.limpiar_items(json.dumps([
            {'producto': '', 'cantidad': 1}, 'texto', {'producto': 'Avena', 'cantidad': True, 'vence': 'mañana', 'extra': 'x'},
        ]))
        self.assertEqual(items, [{'tipo': None, 'producto': 'Avena', 'cantidad': None, 'unidad': '', 'vence': None}])


class ProveedoresIATests(PruebaAPI):
    """Como se leen IA_1_*, IA_2_*... de las variables de entorno."""

    def leer(self, variables):
        from core import settings as conf
        with mock.patch.dict(os.environ, variables, clear=False):
            for n in range(1, 10):
                for campo in ('URL', 'KEY', 'MODELOS', 'REASONING'):
                    if f'IA_{n}_{campo}' not in variables:
                        os.environ.pop(f'IA_{n}_{campo}', None)
            return conf._proveedores_ia()

    def test_proveedores_en_orden_con_sus_modelos(self):
        proveedores = self.leer({
            'IA_1_URL': 'https://api.groq.com/openai/', 'IA_1_KEY': 'k1', 'IA_1_MODELOS': 'openai/gpt-oss-20b, openai/gpt-oss-120b',
            'IA_2_URL': GEMINI, 'IA_2_KEY': 'k2', 'IA_2_MODELOS': 'gemini-3.5-flash-lite,gemini-2.5-flash', 'IA_2_REASONING': '',
        })
        self.assertEqual([(p['nombre'], p['url'], p['modelos'], p['reasoning']) for p in proveedores], [
            ('IA_1', 'https://api.groq.com/openai', ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'], 'low'),
            ('IA_2', GEMINI, ['gemini-3.5-flash-lite', 'gemini-2.5-flash'], ''),
        ])

    def test_sin_modelos_o_con_huecos(self):
        # IA_1 sin modelos no se usa; IA_3 sin IA_2 si
        proveedores = self.leer({'IA_1_URL': 'https://a.test', 'IA_3_URL': 'https://c.test', 'IA_3_MODELOS': 'm'})
        self.assertEqual([p['nombre'] for p in proveedores], ['IA_3'])
        self.assertEqual(self.leer({}), [])


class SaludTests(PruebaAPI):
    def test_responde_sin_sesion(self):
        r = self.client.get('/api/salud/')
        self.assertEqual((r.status_code, r.data), (200, {'ok': True}))


class DictadoMerchTests(PruebaAPI):
    def test_ventas_y_compras(self):
        items = dictado.limpiar_items(json.dumps([
            {'tipo': 'salida', 'producto': 'Panetón', 'cantidad': 3, 'comprador': ' Rosa   Quispe ', 'precio': 25, 'medio_pago': 'yape-plin'},
            {'tipo': 'ingreso', 'producto': 'Polo', 'cantidad': 5, 'proveedor': 'Textiles Sur', 'precio': -2, 'medio_pago': 'tarjeta'},
            {'producto': 'Taza', 'precio': True, 'comprador': ['x']},
        ]))
        self.assertEqual(items[0]['comprador'], 'Rosa Quispe')
        self.assertEqual((items[0]['precio'], items[0]['medio_pago']), (25, 'yape-plin'))
        self.assertEqual(items[1]['proveedor'], 'Textiles Sur')
        self.assertNotIn('precio', items[1])
        self.assertNotIn('medio_pago', items[1])
        self.assertEqual(set(items[2]), {'tipo', 'producto', 'cantidad', 'unidad', 'vence'})
