"""Prepara CouchDB para la app (lo mismo que couchDB/setup.ps1, pero corre en Linux y en Railway).

    python manage.py setup_couch                       # bases, casa_app, permisos e indices
    python manage.py setup_couch --datos ../couchDB/datos_actuales.json   # ademas carga datos

Se puede correr las veces que se quiera: lo que ya existe se deja como esta.
Si la contraseña de casa_app (COUCHDB_PASSWORD) cambio, la actualiza en CouchDB.

Necesita la cuenta de administrador de CouchDB en COUCHDB_ADMIN_USER y COUCHDB_ADMIN_PASSWORD.
Django usa casa_app para el dia a dia; el administrador solo hace falta para esto.
"""
import json
import os
from pathlib import Path
from urllib.parse import quote

import requests
from django.core.management.base import BaseCommand, CommandError

from api.couchdb_service import COUCHDB_PASSWORD, COUCHDB_URL, COUCHDB_USER, DBS

TIMEOUT = 15
BASES_SISTEMA = ('_users', '_replicator')
TAMANO_LOTE = 500


def cliente(usuario, clave):
    """Sesion HTTP con usuario y clave (separado para poder reemplazarlo en las pruebas)."""
    s = requests.Session()
    s.auth = (usuario, clave)
    return s


class Command(BaseCommand):
    help = 'Crea las bases de CouchDB, el usuario casa_app, permisos e indices (y opcionalmente carga datos)'

    def add_arguments(self, parser):
        parser.add_argument('--datos', help='archivo JSON con documentos para cargar (por ejemplo datos_actuales.json)')

    def handle(self, *args, **opciones):
        admin_user = os.getenv('COUCHDB_ADMIN_USER', 'admin')
        admin_clave = os.getenv('COUCHDB_ADMIN_PASSWORD')
        if not admin_clave:
            raise CommandError('Falta COUCHDB_ADMIN_PASSWORD (la contraseña del administrador de CouchDB)')

        self.admin = cliente(admin_user, admin_clave)
        self.paso('Conectando con CouchDB', self.comprobar)
        self.paso('Bases de sistema', lambda: [self.crear_base(b) for b in BASES_SISTEMA])
        self.paso('Bases de la app', lambda: [self.crear_base(b) for b in DBS.values()])
        self.paso(f'Usuario {COUCHDB_USER}', self.usuario_app)
        self.paso('Permisos (solo la app puede leer y escribir)', self.permisos)
        self.paso('Indices', self.indices)
        if opciones.get('datos'):
            self.paso('Datos', lambda: self.cargar(opciones['datos']))
        self.stdout.write(self.style.SUCCESS('CouchDB listo.'))

    # ---------- ayudas ----------

    def paso(self, nombre, accion):
        self.stdout.write(f'- {nombre}...')
        accion()

    def pedir(self, metodo, ruta, sesion=None, **kwargs):
        try:
            r = (sesion or self.admin).request(metodo, f'{COUCHDB_URL}/{ruta}', timeout=TIMEOUT, **kwargs)
        except requests.exceptions.RequestException as e:
            raise CommandError(f'No se pudo conectar con CouchDB en {COUCHDB_URL}: {e}')
        try:
            datos = r.json()
        except ValueError:
            datos = {}
        return r.status_code, datos

    # ---------- pasos ----------

    def comprobar(self):
        status, datos = self.pedir('GET', '_session')
        if status != 200 or '_admin' not in (datos.get('userCtx') or {}).get('roles', []):
            raise CommandError('Usuario o contraseña de administrador de CouchDB incorrectos')

    def crear_base(self, nombre):
        status, _ = self.pedir('GET', quote(nombre, safe=''))
        if status == 200:
            self.stdout.write(f'    {nombre}: ya existe')
            return
        status, datos = self.pedir('PUT', quote(nombre, safe=''))
        if status not in (201, 202, 412):
            raise CommandError(f'No se pudo crear {nombre}: {datos}')
        self.stdout.write(f'    {nombre}: creada')

    def usuario_app(self):
        if not COUCHDB_PASSWORD:
            raise CommandError('Falta COUCHDB_PASSWORD (la contraseña de casa_app)')
        ruta = f"_users/{quote('org.couchdb.user:' + COUCHDB_USER, safe='')}"
        status, actual = self.pedir('GET', ruta)
        if status == 200:
            # ¿la contraseña de las variables sigue sirviendo? si no, se actualiza
            if self._nombre_sesion(COUCHDB_USER, COUCHDB_PASSWORD) == COUCHDB_USER:
                self.stdout.write('    ya existe (contraseña al dia)')
                return
            doc = {**actual, 'password': COUCHDB_PASSWORD}
            status, datos = self.pedir('PUT', ruta, json=doc)
            if status not in (200, 201):
                raise CommandError(f'No se pudo actualizar la contraseña de {COUCHDB_USER}: {datos}')
            self.stdout.write('    contraseña actualizada')
            return
        doc = {'name': COUCHDB_USER, 'password': COUCHDB_PASSWORD, 'roles': [], 'type': 'user'}
        status, datos = self.pedir('PUT', ruta, json=doc)
        if status not in (200, 201):
            raise CommandError(f'No se pudo crear {COUCHDB_USER}: {datos}')
        self.stdout.write('    creado')

    def _nombre_sesion(self, usuario, clave):
        _, datos = self.pedir('GET', '_session', sesion=cliente(usuario, clave))
        return (datos.get('userCtx') or {}).get('name')

    def permisos(self):
        cuerpo = {'admins': {'names': [], 'roles': []}, 'members': {'names': [COUCHDB_USER], 'roles': []}}
        for base in DBS.values():
            status, datos = self.pedir('PUT', f'{quote(base, safe="")}/_security', json=cuerpo)
            # sin permisos la base queda abierta a cualquier usuario valido: se detiene
            if status not in (200, 201):
                raise CommandError(f'No se pudieron poner los permisos de {base}: {datos}')

    def indices(self):
        cuerpo = {'index': {'fields': ['tipo']}, 'name': 'idx-tipo', 'type': 'json'}
        for base in DBS.values():
            status, datos = self.pedir('POST', f'{quote(base, safe="")}/_index', json=cuerpo)
            if status not in (200, 201):
                raise CommandError(f'No se pudo crear el indice de {base}: {datos}')

    def cargar(self, archivo):
        ruta = Path(archivo)
        if not ruta.is_file():
            raise CommandError(f'No existe el archivo {ruta}')
        datos = json.loads(ruta.read_text(encoding='utf-8'))
        if isinstance(datos, list):
            docs = datos
        elif 'docs' in datos:
            docs = datos['docs']
        elif 'rows' in datos:
            docs = [r.get('doc') for r in datos['rows']]
        elif '_id' in datos:
            docs = [datos]
        else:
            raise CommandError('No se reconoce el formato del archivo de datos')

        por_base = {base: [] for base in DBS.values()}
        omitidos = 0
        for doc in docs:
            if not isinstance(doc, dict) or str(doc.get('_id', '')).startswith('_design/'):
                continue
            base = DBS.get(doc.get('tipo'))
            if not base:
                omitidos += 1
                continue
            # la base asigna sus propias revisiones
            por_base[base].append({k: v for k, v in doc.items() if k != '_rev'})

        for base, lista in por_base.items():
            cargados = existian = errores = 0
            for i in range(0, len(lista), TAMANO_LOTE):
                status, resultado = self.pedir('POST', f'{quote(base, safe="")}/_bulk_docs',
                                               json={'docs': lista[i:i + TAMANO_LOTE]})
                if status not in (200, 201) or not isinstance(resultado, list):
                    raise CommandError(f'Error cargando datos en {base}: {resultado}')
                for r in resultado:
                    if r.get('ok'):
                        cargados += 1
                    elif r.get('error') == 'conflict':
                        existian += 1
                    else:
                        errores += 1
            self.stdout.write(f'    {base}: {cargados} cargados, {existian} ya existian, {errores} con error')
        if omitidos:
            self.stdout.write(f'    omitidos por tipo desconocido: {omitidos}')
