"""Respaldo de todas las bases de la app en un solo JSON (mismo formato que datos_actuales.json).

    python manage.py exportar_couch > respaldo.json
    python manage.py setup_couch --datos respaldo.json      # para restaurar en una CouchDB vacia

OJO: incluye los usuarios con el hash de su contraseña. Guarda el archivo en un lugar privado.
"""
import json

from django.core.management.base import BaseCommand, CommandError

from api.couchdb_service import COUCHDB_URL, DBS, _request

PAGINA = 1000


class Command(BaseCommand):
    help = 'Escribe en pantalla un JSON con todos los documentos de la app (para respaldos)'

    def handle(self, *args, **opciones):
        docs = []
        for base in DBS.values():
            desde = None
            while True:
                params = {'include_docs': 'true', 'limit': PAGINA + 1}
                if desde:
                    params['startkey'] = json.dumps(desde)
                datos, status = _request('GET', f'{COUCHDB_URL}/{base}/_all_docs', params=params)
                if status != 200:
                    raise CommandError(f'No se pudo leer {base}: {datos}')
                filas = datos.get('rows', [])
                for fila in filas[:PAGINA]:
                    if not fila['id'].startswith('_design/') and fila.get('doc'):
                        docs.append({k: v for k, v in fila['doc'].items() if k != '_rev'})
                if len(filas) <= PAGINA:
                    break
                desde = filas[PAGINA]['id']
        self.stdout.write(json.dumps({'docs': docs}, ensure_ascii=False, indent=1))
        self.stderr.write(f'{len(docs)} documentos exportados')
