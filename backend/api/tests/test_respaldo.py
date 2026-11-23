"""Respaldos en Google Drive: que se guarda, que se borra y el comando respaldo_drive (sin llamar a Google)."""
import gzip
import json
import os
import tempfile
from datetime import datetime, timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings

from api import respaldo
from api.management.commands.autorizar_drive import leer_credenciales
from api.respaldo import ZONA, ErrorRespaldo, fecha_de, nombre_respaldo, que_borrar

from .base import PruebaAPI


def archivos_desde(fechas):
    return [{'id': f'id{i}', 'name': nombre_respaldo(f)} for i, f in enumerate(fechas)]


class QueBorrarTests(SimpleTestCase):
    ahora = datetime(2026, 11, 24, 3, 0, tzinfo=ZONA)

    def guardados(self, archivos, **cuantos):
        sobran = set(que_borrar(archivos, self.ahora, **cuantos))
        return sorted(fecha_de(a['name']) for a in archivos if a['id'] not in sobran)

    def test_nombre_y_fecha(self):
        self.assertEqual(nombre_respaldo(self.ahora), 'respaldo-2026-11-24_0300.json.gz')
        self.assertEqual(fecha_de('respaldo-2026-11-24_0300.json.gz'), self.ahora)
        self.assertIsNone(fecha_de('otra cosa.pdf'))

    def test_un_respaldo_diario_por_dos_años(self):
        fechas = [self.ahora - timedelta(days=d) for d in range(730)]
        quedan = self.guardados(archivos_desde(fechas))
        dias = {f.date() for f in quedan}
        # los ultimos 7 dias
        for d in range(7):
            self.assertIn((self.ahora - timedelta(days=d)).date(), dias)
        # el ultimo de cada una de las ultimas 4 semanas y de cada uno de los ultimos 12 meses
        semanas = {f.isocalendar()[:2] for f in quedan}
        meses = {(f.year, f.month) for f in quedan}
        for s in range(4):
            self.assertIn((self.ahora - timedelta(weeks=s)).isocalendar()[:2], semanas)
        self.assertGreaterEqual(len([m for m in meses if (2026 - m[0]) * 12 + 11 - m[1] < 12]), 12)
        # un respaldo por año, aunque sea viejo (2024 y 2025)
        self.assertEqual({f.year for f in quedan}, {2024, 2025, 2026})
        # no se guardan de mas: 7 + 4 + 12 + años como mucho
        self.assertLessEqual(len(quedan), 7 + 4 + 12 + 3)

    def test_el_mismo_dia_queda_solo_el_ultimo(self):
        hoy = [self.ahora - timedelta(hours=h) for h in range(3)]
        quedan = self.guardados(archivos_desde(hoy))
        self.assertEqual(quedan, [self.ahora])

    def test_cada_hora_para_probar(self):
        fechas = [self.ahora - timedelta(hours=h) for h in range(48)]
        quedan = self.guardados(archivos_desde(fechas), horas=24)
        # las ultimas 24 horas, y de antes solo el ultimo de cada dia
        self.assertTrue(all(self.ahora - timedelta(hours=h) in quedan for h in range(24)))
        self.assertLess(len(quedan), 30)

    def test_lo_que_no_es_un_respaldo_no_se_toca(self):
        archivos = archivos_desde([self.ahora - timedelta(days=400 + d) for d in range(3)]) + [{'id': 'x', 'name': 'notas.txt'}]
        self.assertNotIn('x', que_borrar(archivos, self.ahora))

    def test_sin_respaldos(self):
        self.assertEqual(que_borrar([], self.ahora), [])


class DriveFalso:
    """Lo que haria Google Drive, en memoria."""

    def __init__(self, token):
        self.token = token
        self.archivos = DriveFalso.iniciales[:]
        self.subidos = []
        self.borrados = []

    def carpeta(self, nombre):
        self.nombre_carpeta = nombre
        return 'carpeta1'

    def subir(self, nombre, contenido, carpeta_id):
        self.subidos.append((nombre, contenido, carpeta_id))
        self.archivos.append({'id': f'nuevo{len(self.subidos)}', 'name': nombre})
        return {'id': f'nuevo{len(self.subidos)}'}

    def listar(self, carpeta_id):
        return self.archivos[:]

    def borrar(self, archivo_id):
        self.borrados.append(archivo_id)


CREDENCIALES = {'DRIVE_CLIENT_ID': 'cliente', 'DRIVE_CLIENT_SECRET': 'secreto', 'DRIVE_REFRESH_TOKEN': 'permiso'}


@override_settings(**CREDENCIALES)
class RespaldoDriveTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        DriveFalso.iniciales = []
        self.drives = []
        crear = lambda token: self.drives.append(DriveFalso(token)) or self.drives[-1]
        for objetivo, valor in (('token_acceso', mock.Mock(return_value='acceso')), ('Drive', crear)):
            parche = mock.patch.object(respaldo, objetivo, valor)
            parche.start()
            self.addCleanup(parche.stop)

    def correr(self, *args):
        salida = StringIO()
        call_command('respaldo_drive', *args, stdout=salida)
        return salida.getvalue()

    def test_sube_toda_la_base_comprimida(self):
        self.crear_producto('Arroz')
        salida = self.correr()
        drive = self.drives[0]
        [(nombre, contenido, carpeta)] = drive.subidos
        self.assertRegex(nombre, r'^respaldo-\d{4}-\d{2}-\d{2}_\d{4}\.json\.gz$')
        self.assertEqual((carpeta, drive.nombre_carpeta), ('carpeta1', 'Respaldos Hogar San Aníbal'))
        docs = json.loads(gzip.decompress(contenido))['docs']
        # sirve para setup_couch --datos: sin _rev
        self.assertIn('Arroz', {d.get('nombre') for d in docs})
        self.assertIn('usuario:admin', {d['_id'] for d in docs})
        self.assertTrue(all('_rev' not in d for d in docs))
        self.assertIn('Subido', salida)

    def test_borra_los_que_sobran(self):
        viejos = [datetime.now(ZONA) - timedelta(days=d) for d in range(1, 20)]
        DriveFalso.iniciales = archivos_desde(viejos)
        self.correr()
        drive = self.drives[0]
        esperados = que_borrar(drive.archivos, datetime.now(ZONA))
        self.assertTrue(drive.borrados)
        self.assertEqual(sorted(drive.borrados), sorted(esperados))
        # el recien subido nunca se borra
        self.assertNotIn('nuevo1', drive.borrados)

    def test_sin_borrar(self):
        DriveFalso.iniciales = archivos_desde([datetime.now(ZONA) - timedelta(days=d) for d in range(1, 20)])
        self.correr('--sin-borrar')
        self.assertEqual(self.drives[0].borrados, [])

    def test_si_falla_google_no_se_lee_la_base(self):
        respaldo.token_acceso.side_effect = ErrorRespaldo('Google no dio acceso')
        with mock.patch.object(respaldo, 'exportar') as exportar, self.assertRaisesMessage(CommandError, 'No se hizo el respaldo'):
            self.correr()
        exportar.assert_not_called()

    def test_si_falla_la_base_no_se_sube_nada(self):
        self.couch.caida = True
        with self.assertRaises(CommandError):
            self.correr()
        self.assertEqual(self.drives[0].subidos, [])


class GoogleTests(SimpleTestCase):
    def test_faltan_las_variables(self):
        with self.assertRaisesMessage(ErrorRespaldo, 'Faltan DRIVE_CLIENT_ID'):
            respaldo.token_acceso('', 'secreto', 'permiso')

    def test_permiso_quitado(self):
        r = mock.Mock(status_code=400, text='', json=lambda: {'error': 'invalid_grant', 'error_description': 'Token has been expired or revoked.'})
        with mock.patch.object(respaldo.requests, 'post', return_value=r), self.assertRaisesMessage(ErrorRespaldo, 'autorizar_drive'):
            respaldo.token_acceso('cliente', 'secreto', 'permiso')

    def test_subir_manda_nombre_carpeta_y_contenido(self):
        drive = respaldo.Drive('acceso')
        r = mock.Mock(status_code=200, content=b'{}', json=lambda: {'id': 'a1'})
        with mock.patch.object(drive.sesion, 'request', return_value=r) as pedir:
            drive.subir('respaldo-2026-11-24_0300.json.gz', b'\x1f\x8bdatos', 'carpeta1')
        metodo, url = pedir.call_args.args
        cuerpo = pedir.call_args.kwargs['data']
        tipo = pedir.call_args.kwargs['headers']['Content-Type']
        self.assertEqual((metodo, url), ('POST', respaldo.URL_SUBIR))
        self.assertTrue(tipo.startswith('multipart/related; boundary='))
        self.assertIn(b'"parents": ["carpeta1"]', cuerpo)
        self.assertIn(b'\x1f\x8bdatos', cuerpo)
        self.assertEqual(drive.sesion.headers['Authorization'], 'Bearer acceso')

    def test_error_de_drive(self):
        drive = respaldo.Drive('acceso')
        r = mock.Mock(status_code=403, content=b'x', text='x', json=lambda: {'error': {'message': 'Insufficient Permission'}})
        with mock.patch.object(drive.sesion, 'request', return_value=r), self.assertRaisesMessage(ErrorRespaldo, 'Insufficient Permission'):
            drive.listar('carpeta1')

    def test_credenciales_del_json_de_google(self):
        with tempfile.TemporaryDirectory() as carpeta:
            ruta = os.path.join(carpeta, 'cliente.json')
            with open(ruta, 'w', encoding='utf-8') as f:
                json.dump({'installed': {'client_id': 'id.apps.googleusercontent.com', 'client_secret': 'GOCSPX-x'}}, f)
            self.assertEqual(leer_credenciales(ruta), ('id.apps.googleusercontent.com', 'GOCSPX-x'))
            with open(ruta, 'w', encoding='utf-8') as f:
                json.dump({'web': {'client_id': 'a', 'client_secret': 'b'}}, f)
            with self.assertRaisesMessage(CommandError, 'App de escritorio'):
                leer_credenciales(ruta)
