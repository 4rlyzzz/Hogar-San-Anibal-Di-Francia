"""Respaldos de la base en Google Drive.

- exportar(): todos los documentos de la app (lo mismo que "python manage.py exportar_couch")
- Drive: sube, lista y borra archivos con la API de Google Drive (solo con requests)
- que_borrar(): cuales respaldos sobran segun cuantos se guardan de cada tipo

Cuantos se guardan (se puede cambiar con variables, ver settings.py):
    diarios: el ultimo de cada uno de los ultimos 7 dias
    semanales: el ultimo de cada una de las ultimas 4 semanas
    mensuales: el ultimo de cada uno de los ultimos 12 meses
    anuales: el ultimo de cada año, todos
Un mismo respaldo puede contar como diario, semanal, mensual y anual a la vez: se borra
solo el que no le sirve a ninguno.

El permiso de Drive es "drive.file": la app solo ve los archivos que ella misma creo,
nunca el resto del Drive del Hogar.
"""
import gzip
import json
import re
import uuid
from datetime import datetime, timedelta, timezone

import requests

from .couchdb_service import COUCHDB_URL, DBS, _request

# hora de Lima: el nombre del archivo y "que dia es" van en esa hora
ZONA = timezone(timedelta(hours=-5))
PAGINA = 1000
ESPERA = 60  # segundos por pedido a Google

URL_TOKEN = 'https://oauth2.googleapis.com/token'
URL_ARCHIVOS = 'https://www.googleapis.com/drive/v3/files'
URL_SUBIR = 'https://www.googleapis.com/upload/drive/v3/files'
TIPO_CARPETA = 'application/vnd.google-apps.folder'
PERMISO = 'https://www.googleapis.com/auth/drive.file'

# respaldo-2026-11-24_0300.json.gz
FORMATO_NOMBRE = 'respaldo-%Y-%m-%d_%H%M.json.gz'
NOMBRE = re.compile(r'^respaldo-(\d{4}-\d{2}-\d{2}_\d{4})\.json\.gz$')


class ErrorRespaldo(Exception):
    pass


# ---------- la base ----------
def exportar():
    """{'docs': [...]} con todos los documentos (sin _rev ni los indices). Sirve para setup_couch --datos."""
    docs = []
    for base in DBS.values():
        desde = None
        while True:
            params = {'include_docs': 'true', 'limit': PAGINA + 1}
            if desde:
                params['startkey'] = json.dumps(desde)
            datos, status = _request('GET', f'{COUCHDB_URL}/{base}/_all_docs', params=params)
            if status != 200:
                raise ErrorRespaldo(f'No se pudo leer {base} ({status})')
            filas = datos.get('rows', [])
            for fila in filas[:PAGINA]:
                if not fila['id'].startswith('_design/') and fila.get('doc'):
                    docs.append({k: v for k, v in fila['doc'].items() if k != '_rev'})
            if len(filas) <= PAGINA:
                break
            desde = filas[PAGINA]['id']
    return {'docs': docs}


def comprimir(datos):
    return gzip.compress(json.dumps(datos, ensure_ascii=False).encode('utf-8'))


def nombre_respaldo(momento):
    return momento.astimezone(ZONA).strftime(FORMATO_NOMBRE)


def fecha_de(nombre):
    """La fecha del respaldo segun su nombre (hora de Lima), o None si no es un respaldo."""
    m = NOMBRE.match(nombre or '')
    return datetime.strptime(m.group(1), '%Y-%m-%d_%H%M').replace(tzinfo=ZONA) if m else None


# ---------- cuales sobran ----------
def que_borrar(archivos, ahora, diarios=7, semanales=4, mensuales=12, horas=0):
    """archivos: [{'id', 'name'}] -> ids de los respaldos que ya no hace falta guardar.

    Se guarda el ultimo de cada hora (las ultimas `horas`), de cada dia (los ultimos `diarios`),
    de cada semana (las ultimas `semanales`), de cada mes (los ultimos `mensuales`) y de cada año.
    Lo que no tiene nombre de respaldo no se toca.
    """
    ahora = ahora.astimezone(ZONA)
    respaldos = sorted(
        ((fecha_de(a.get('name')), a['id']) for a in archivos if fecha_de(a.get('name'))),
        reverse=True,
    )
    hoy = ahora.date()
    lunes = hoy - timedelta(days=hoy.weekday())
    grupos = [
        # (clave del grupo, si ese grupo todavia se guarda)
        (lambda f: f.strftime('%Y-%m-%d %H'), lambda f: horas > 0 and f > ahora - timedelta(hours=horas)),
        (lambda f: f.date(), lambda f: (hoy - f.date()).days < diarios),
        (lambda f: f.isocalendar()[:2], lambda f: (lunes - (f.date() - timedelta(days=f.weekday()))).days // 7 < semanales),
        (lambda f: (f.year, f.month), lambda f: (ahora.year - f.year) * 12 + ahora.month - f.month < mensuales),
        (lambda f: f.year, lambda f: True),
    ]
    guardar = set()
    for clave, vigente in grupos:
        vistos = set()
        # del mas nuevo al mas viejo: el primero de cada grupo es su ultimo respaldo
        for fecha, ident in respaldos:
            k = clave(fecha)
            if k in vistos:
                continue
            vistos.add(k)
            if vigente(fecha):
                guardar.add(ident)
    return [ident for _, ident in respaldos if ident not in guardar]


# ---------- Google Drive ----------
def token_acceso(client_id, client_secret, refresh_token):
    """Pide a Google un permiso de acceso de una hora con el refresh token de autorizar_drive."""
    if not (client_id and client_secret and refresh_token):
        raise ErrorRespaldo('Faltan DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET o DRIVE_REFRESH_TOKEN (ver DESPLIEGUE.md)')
    r = requests.post(URL_TOKEN, data={
        'client_id': client_id, 'client_secret': client_secret,
        'refresh_token': refresh_token, 'grant_type': 'refresh_token',
    }, timeout=ESPERA)
    if r.status_code != 200:
        # invalid_grant: se quito el permiso o la app quedo en modo prueba (vence a los 7 dias)
        error = _error_de(r)
        raise ErrorRespaldo(f'Google no dio acceso ({r.status_code} {error}): vuelve a correr autorizar_drive')
    return r.json()['access_token']


def _error_de(r):
    try:
        datos = r.json()
    except ValueError:
        return r.text[:200]
    error = datos.get('error')
    if isinstance(error, dict):
        return error.get('message', '')
    return f"{error or ''} {datos.get('error_description', '')}".strip()


class Drive:
    def __init__(self, token):
        self.sesion = requests.Session()
        self.sesion.headers['Authorization'] = f'Bearer {token}'

    def _pedir(self, metodo, url, **kwargs):
        r = self.sesion.request(metodo, url, timeout=ESPERA, **kwargs)
        if r.status_code >= 400:
            raise ErrorRespaldo(f'Drive respondio {r.status_code}: {_error_de(r)}')
        return r.json() if r.content else {}

    def carpeta(self, nombre):
        """El id de la carpeta (la crea si no existe). Solo ve las que creo esta app."""
        nombre_q = nombre.replace('\\', '\\\\').replace("'", "\\'")
        q = f"name = '{nombre_q}' and mimeType = '{TIPO_CARPETA}' and trashed = false"
        encontradas = self._pedir('GET', URL_ARCHIVOS, params={'q': q, 'fields': 'files(id)', 'spaces': 'drive'}).get('files', [])
        if encontradas:
            return encontradas[0]['id']
        return self._pedir('POST', URL_ARCHIVOS, json={'name': nombre, 'mimeType': TIPO_CARPETA}, params={'fields': 'id'})['id']

    def subir(self, nombre, contenido, carpeta_id):
        """Sube un archivo (subida en una sola parte: los respaldos son chicos). Devuelve su id."""
        # "multipart/related": primero los datos del archivo (nombre y carpeta), despues el contenido
        limite = f'respaldo{uuid.uuid4().hex}'
        metadatos = json.dumps({'name': nombre, 'parents': [carpeta_id]}).encode('utf-8')
        cuerpo = b''.join([
            f'--{limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'.encode(), metadatos,
            f'\r\n--{limite}\r\nContent-Type: application/gzip\r\n\r\n'.encode(), contenido,
            f'\r\n--{limite}--\r\n'.encode(),
        ])
        return self._pedir(
            'POST', URL_SUBIR, params={'uploadType': 'multipart', 'fields': 'id,name,size'},
            data=cuerpo, headers={'Content-Type': f'multipart/related; boundary={limite}'},
        )

    def listar(self, carpeta_id):
        """[{'id', 'name'}] de lo que hay en la carpeta."""
        archivos = []
        pagina = None
        while True:
            params = {'q': f"'{carpeta_id}' in parents and trashed = false", 'fields': 'nextPageToken,files(id,name)', 'pageSize': 1000}
            if pagina:
                params['pageToken'] = pagina
            datos = self._pedir('GET', URL_ARCHIVOS, params=params)
            archivos += datos.get('files', [])
            pagina = datos.get('nextPageToken')
            if not pagina:
                return archivos

    def borrar(self, archivo_id):
        self._pedir('DELETE', f'{URL_ARCHIVOS}/{archivo_id}')
