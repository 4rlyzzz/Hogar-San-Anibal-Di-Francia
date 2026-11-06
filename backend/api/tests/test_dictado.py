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
        self.assertEqual(post.call_args.kwargs['json']['model'], 'modelo')

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
