"""Base de las pruebas: una CouchDB falsa en memoria.

Las pruebas nunca tocan la CouchDB real: se reemplaza session.request de couchdb_service
por esta clase, que responde como CouchDB (409 si el _rev no coincide, _find con bookmark, etc.).
"""
import itertools
import uuid
from copy import deepcopy
from unittest import mock
from urllib.parse import unquote, urlparse

import requests
from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from api import couchdb_service

CLAVE = 'clave1234'


class Respuesta:
    def __init__(self, data, status):
        self._data = data
        self.status_code = status
        self.text = str(data)

    def json(self):
        return deepcopy(self._data)


class CouchFalsa:
    """bases: {nombre_base: {_id: doc}}"""

    def __init__(self):
        self.bases = {nombre: {} for nombre in couchdb_service.DBS.values()}
        self._revs = itertools.count(1)
        # para simular fallas: {('PUT', 'casa_movimientos'): status} o caida=True
        self.fallas = {}
        self.caida = False
        # conflictos de mentira: los proximos N PUT a esa base responden 409
        self.conflictos = {}
        self.llamadas = []

    def _rev(self):
        return f'{next(self._revs)}-{uuid.uuid4().hex[:8]}'

    def base(self, tipo):
        return self.bases[couchdb_service.DBS[tipo]]

    def poner(self, tipo, doc):
        """Guarda un documento directamente (como si ya estuviera en la base)."""
        doc = {'tipo': tipo, **deepcopy(doc)}
        doc.setdefault('_id', uuid.uuid4().hex)
        doc['_rev'] = self._rev()
        self.base(tipo)[doc['_id']] = doc
        return deepcopy(doc)

    def leer(self, tipo, doc_id):
        doc = self.base(tipo).get(doc_id)
        return deepcopy(doc) if doc else None

    def todos(self, tipo):
        return [deepcopy(d) for d in self.base(tipo).values()]

    def request(self, method, url, timeout=None, json=None, params=None):
        self.llamadas.append((method, url))
        if self.caida:
            raise requests.exceptions.ConnectionError('CouchDB apagada')

        partes = [unquote(p) for p in urlparse(url).path.strip('/').split('/')]
        nombre, doc_id = partes[0], (partes[1] if len(partes) > 1 else None)
        if nombre not in self.bases:
            return Respuesta({'error': 'not_found'}, 404)
        if (method, nombre) in self.fallas:
            return Respuesta({'error': 'falla simulada'}, self.fallas[(method, nombre)])
        base = self.bases[nombre]

        if method == 'POST' and doc_id == '_find':
            return self._find(base, json)
        if method == 'POST' and doc_id is None:
            return self._guardar(base, nombre, uuid.uuid4().hex, json)
        if method == 'GET':
            doc = base.get(doc_id)
            return Respuesta(doc, 200) if doc else Respuesta({'error': 'not_found'}, 404)
        if method == 'PUT':
            return self._guardar(base, nombre, doc_id, json)
        if method == 'DELETE':
            doc = base.get(doc_id)
            if not doc:
                return Respuesta({'error': 'not_found'}, 404)
            if (params or {}).get('rev') != doc['_rev']:
                return Respuesta({'error': 'conflict'}, 409)
            del base[doc_id]
            return Respuesta({'ok': True, 'id': doc_id, 'rev': self._rev()}, 200)
        return Respuesta({'error': 'method_not_allowed'}, 405)

    def _guardar(self, base, nombre, doc_id, json):
        if self.conflictos.get(nombre):
            self.conflictos[nombre] -= 1
            return Respuesta({'error': 'conflict'}, 409)
        actual = base.get(doc_id)
        if actual and json.get('_rev') != actual['_rev']:
            return Respuesta({'error': 'conflict'}, 409)
        if not actual and json.get('_rev'):
            return Respuesta({'error': 'conflict'}, 409)
        doc = {**deepcopy(json), '_id': doc_id, '_rev': self._rev()}
        base[doc_id] = doc
        return Respuesta({'ok': True, 'id': doc_id, 'rev': doc['_rev']}, 201)

    def _find(self, base, query):
        selector = query.get('selector', {})
        docs = [d for d in base.values() if all(d.get(k) == v for k, v in selector.items())]
        desde = int(query.get('bookmark') or 0)
        limite = query.get('limit', 25)
        pagina = docs[desde:desde + limite]
        return Respuesta({'docs': deepcopy(pagina), 'bookmark': str(desde + len(pagina))}, 200)


# MD5 solo en pruebas: con el hasher real cada usuario tarda medio segundo
@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class PruebaAPI(TestCase):
    def setUp(self):
        cache.clear()
        self.couch = CouchFalsa()
        parche = mock.patch.object(couchdb_service.session, 'request', side_effect=self.couch.request)
        parche.start()
        self.addCleanup(parche.stop)
        # sin esperas entre reintentos (solo hacen lentas las pruebas)
        espera = mock.patch.object(couchdb_service.time, 'sleep')
        espera.start()
        self.addCleanup(espera.stop)
        self.client = APIClient()

        self.admin = self.crear_usuario('admin', 'Administrador', nombre='Dirección', principal=True)
        self.usuario = self.crear_usuario('cocina', 'Usuario', nombre='Cocina')

    # ---------- ayudas ----------

    def crear_usuario(self, usuario, rol, nombre=None, activo=True, **extra):
        return self.couch.poner('usuario', {
            '_id': f'usuario:{usuario}', 'usuario': usuario, 'nombre': nombre or usuario,
            'rol': rol, 'activo': activo, 'clave': make_password(CLAVE), **extra,
        })

    def entrar_como(self, cuenta):
        refresh = RefreshToken()
        refresh['user_id'] = cuenta['_id']
        refresh['username'] = cuenta['usuario']
        refresh['rol'] = cuenta['rol']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        return refresh

    def salir(self):
        self.client.credentials()

    def crear_producto(self, nombre='Arroz', categoria='alimentos', unidad='kg', cantidad=0, lotes=None, **extra):
        return self.couch.poner('producto', {
            '_id': f'producto:{categoria}:{couchdb_service.slug(nombre)}',
            'nombre': nombre, 'categoria': categoria, 'unidad': unidad,
            'cantidad': cantidad, 'stock_minimo': 5, 'lotes': lotes or [], 'codigosBarras': [], **extra,
        })

    def lote(self, id, quedan, vence=None, ingreso='2026-10-01T12:00:00+00:00'):
        return {'id': id, 'ingreso': ingreso, 'vence': vence, 'cantidad': quedan, 'quedan': quedan, 'origen': ''}
