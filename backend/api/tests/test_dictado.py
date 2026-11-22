import json
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


@override_settings(OMNIROUTE_URL='http://omniroute.test', OMNIROUTE_API_KEY='clave-de-prueba', OMNIROUTE_MODEL='modelo')
class DictadoTests(PruebaAPI):
    def dictar(self, texto='dos kilos de arroz'):
        return self.client.post('/api/dictado/', {'texto': texto}, format='json')

    def test_pide_sesion(self):
        self.assertEqual(self.dictar().status_code, 401)

    @override_settings(OMNIROUTE_URL='')
    def test_sin_configurar_responde_503(self):
        self.entrar_como(self.usuario)
        self.assertEqual(self.dictar().status_code, 503)

    def test_la_clave_va_al_servidor_y_no_el_token_de_la_app(self):
        self.entrar_como(self.usuario)
        contenido = json.dumps([{'tipo': 'ingreso', 'producto': 'Arroz', 'cantidad': 2, 'unidad': 'kg', 'vence': None}])
        with mock.patch.object(dictado.requests, 'post', return_value=RespuestaIA(contenido)) as post:
            r = self.dictar()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['items'], [{'tipo': 'ingreso', 'producto': 'Arroz', 'cantidad': 2, 'unidad': 'kg', 'vence': None}])
        url = post.call_args.args[0]
        cabeceras = post.call_args.kwargs['headers']
        self.assertEqual(url, 'http://omniroute.test/v1/chat/completions')
        self.assertEqual(cabeceras['Authorization'], 'Bearer clave-de-prueba')
        cuerpo = post.call_args.kwargs['json']
        self.assertEqual(cuerpo['model'], 'modelo')
        self.assertEqual(cuerpo['reasoning_effort'], 'low')

    def test_direccion_de_cada_proveedor(self):
        # OmniRoute y Groq: se agrega la ruta; Gemini: la direccion completa se usa tal cual
        self.assertEqual(dictado.url_chat('http://localhost:20128'), 'http://localhost:20128/v1/chat/completions')
        self.assertEqual(dictado.url_chat('https://api.groq.com/openai/'), 'https://api.groq.com/openai/v1/chat/completions')
        gemini = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
        self.assertEqual(dictado.url_chat(gemini), gemini)
        self.assertEqual(dictado.url_chat(gemini + '/'), gemini)

    @override_settings(OMNIROUTE_URL='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', OMNIROUTE_MODEL='gemini-2.5-flash')
    def test_gemini_con_la_direccion_completa(self):
        self.entrar_como(self.usuario)
        contenido = json.dumps([{'tipo': 'salida', 'producto': 'Panetón', 'cantidad': 2}])
        with mock.patch.object(dictado.requests, 'post', return_value=RespuestaIA(contenido)) as post:
            r = self.dictar()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['items'][0]['producto'], 'Panetón')
        self.assertEqual(post.call_args.args[0], 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
        self.assertEqual(post.call_args.kwargs['json']['model'], 'gemini-2.5-flash')

    @override_settings(OMNIROUTE_REASONING_EFFORT='')
    def test_sin_reasoning_effort_no_se_envia(self):
        self.entrar_como(self.usuario)
        with mock.patch.object(dictado.requests, 'post', return_value=RespuestaIA('[]')) as post:
            self.assertEqual(self.dictar().status_code, 200)
        self.assertNotIn('reasoning_effort', post.call_args.kwargs['json'])

    def test_respuesta_vacia_o_con_razonamiento(self):
        self.assertEqual(dictado.limpiar_items(None), [])
        self.assertEqual(dictado.limpiar_items('<think>el usuario dice arroz</think>\n[{"producto": "Arroz", "cantidad": 2}]'),
                         [{'tipo': None, 'producto': 'Arroz', 'cantidad': 2, 'unidad': '', 'vence': None}])

    def test_omniroute_caido_responde_503(self):
        self.entrar_como(self.usuario)
        with mock.patch.object(dictado.requests, 'post', side_effect=requests.exceptions.ConnectionError()):
            self.assertEqual(self.dictar().status_code, 503)
        with mock.patch.object(dictado.requests, 'post', return_value=RespuestaIA('', status=429)):
            self.assertEqual(self.dictar().status_code, 503)

    def test_limpia_lo_que_devuelve_la_ia(self):
        self.assertEqual(dictado.limpiar_items('no es json'), [])
        self.assertEqual(dictado.limpiar_items('```json\n{"producto": "Leche", "cantidad": "tres"}\n```'),
                         [{'tipo': None, 'producto': 'Leche', 'cantidad': None, 'unidad': '', 'vence': None}])
        items = dictado.limpiar_items(json.dumps([
            {'producto': '', 'cantidad': 1}, 'texto', {'producto': 'Avena', 'cantidad': True, 'vence': 'mañana', 'extra': 'x'},
        ]))
        self.assertEqual(items, [{'tipo': None, 'producto': 'Avena', 'cantidad': None, 'unidad': '', 'vence': None}])


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
