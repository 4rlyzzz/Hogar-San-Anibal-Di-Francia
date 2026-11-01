from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError

from api import couchdb_service as servicio

from .base import CLAVE, PruebaAPI


class ServicioCouchTests(PruebaAPI):
    def test_slug(self):
        self.assertEqual(servicio.slug('Parroquia San José'), 'parroquia-san-jose')
        self.assertEqual(servicio.slug('  ¡Leche / 1L!  '), 'leche-1l')
        self.assertEqual(len(servicio.slug('a' * 200)), 80)

    def test_sin_secretos(self):
        self.assertEqual(servicio.sin_secretos({'a': 1, 'clave': 'x', 'password': 'y'}), {'a': 1})

    def test_no_crea_documentos_reservados_ni_de_tipo_desconocido(self):
        self.assertEqual(servicio.create_document({'tipo': 'otro'})[1], 400)
        self.assertEqual(servicio.create_document({'tipo': 'donador'}, '_design/x')[1], 400)
        _, status = servicio.create_document({'tipo': 'donador', '_id': '_design/x', '_rev': '1', 'nombre': 'A'}, 'donador:a')
        self.assertEqual(status, 201)
        doc = self.couch.leer('donador', 'donador:a')
        self.assertEqual(doc['_id'], 'donador:a')

    def test_id_con_barras_no_cambia_la_url(self):
        servicio.get_document_by_id('../casa_usuarios/usuario:admin', 'producto')
        _, url = self.couch.llamadas[-1]
        self.assertIn('..%2Fcasa_usuarios%2Fusuario%3Aadmin', url)

    def test_trae_todas_las_paginas(self):
        for i in range(450):
            self.couch.poner('donador', {'nombre': f'D{i}'})
        docs, status = servicio.get_documents_by_type('donador')
        self.assertEqual((status, len(docs)), (200, 450))

    def test_couchdb_caida(self):
        self.couch.caida = True
        self.assertEqual(servicio.get_documents_by_type('producto')[1], 503)

    def test_respuesta_que_no_es_json(self):
        malo = mock.Mock(status_code=500, text='<html>')
        malo.json.side_effect = ValueError
        with mock.patch.object(servicio.session, 'request', return_value=malo):
            self.assertEqual(servicio.get_documents_by_type('producto')[1], 502)

    def test_tipo_esperado(self):
        self.assertEqual(servicio.get_document_by_id('usuario:admin', 'producto')[1], 404)
        doc, status = servicio.get_document_by_id('usuario:admin', 'usuario')
        self.assertEqual(status, 200)
        self.assertNotIn('clave', doc)
        self.assertIn('clave', servicio.get_document_con_secretos('usuario:admin', 'usuario')[0])

    def test_actualizar_con_reintento_aplica_sobre_lo_nuevo(self):
        self.crear_producto('Arroz', cantidad=1)
        self.couch.conflictos['casa_inventario'] = 2
        doc, status = servicio.actualizar_con_reintento('producto:alimentos:arroz', 'producto', lambda d: {'cantidad': d['cantidad'] + 1})
        self.assertEqual((status, doc['cantidad']), (200, 2))

    def test_update_fusionar_conserva_campos(self):
        self.crear_producto('Arroz', almacen='Despensa')
        servicio.update_document('producto:alimentos:arroz', {'stock_minimo': 9}, None, 'producto', fusionar=True)
        doc = self.couch.leer('producto', 'producto:alimentos:arroz')
        self.assertEqual((doc['stock_minimo'], doc['almacen']), (9, 'Despensa'))


class ComandosTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.couch.base('usuario').clear()

    def ejecutar(self, comando, claves, **opciones):
        with mock.patch(f'api.management.commands.{comando}.getpass', side_effect=claves):
            call_command(comando, stdout=mock.Mock(), **opciones)

    def test_crear_usuario_primer_admin_es_principal(self):
        self.ejecutar('crear_usuario', [CLAVE, CLAVE], usuario='Director', nombre='Dirección')
        [doc] = self.couch.todos('usuario')
        self.assertEqual((doc['usuario'], doc['rol'], doc['principal']), ('director', 'Administrador', True))
        self.ejecutar('crear_usuario', [CLAVE, CLAVE], usuario='otro', nombre='Otro')
        otro = next(d for d in self.couch.todos('usuario') if d['usuario'] == 'otro')
        self.assertFalse(otro['principal'])

    def test_crear_usuario_errores(self):
        with self.assertRaises(CommandError):
            self.ejecutar('crear_usuario', ['corta', 'corta'], usuario='x', nombre='x')
        with self.assertRaises(CommandError):
            self.ejecutar('crear_usuario', [CLAVE, 'distinta1'], usuario='x', nombre='x')
        self.ejecutar('crear_usuario', [CLAVE, CLAVE], usuario='x', nombre='x')
        with self.assertRaises(CommandError):
            self.ejecutar('crear_usuario', [CLAVE, CLAVE], usuario='X', nombre='x')

    def test_cambiar_clave(self):
        self.ejecutar('crear_usuario', [CLAVE, CLAVE], usuario='director', nombre='Dirección')
        self.ejecutar('cambiar_clave', ['nueva12345', 'nueva12345'], usuario='director')
        r = self.client.post('/api/auth/login/', {'usuario': 'director', 'clave': 'nueva12345'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_cambiar_clave_usuario_inexistente(self):
        with self.assertRaises(CommandError):
            self.ejecutar('cambiar_clave', [CLAVE, CLAVE], usuario='nadie')
