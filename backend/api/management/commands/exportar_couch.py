"""Respaldo de todas las bases de la app en un solo JSON (mismo formato que datos_actuales.json).

    python manage.py exportar_couch > respaldo.json
    python manage.py setup_couch --datos respaldo.json      # para restaurar en una CouchDB vacia

OJO: incluye los usuarios con el hash de su contraseña. Guarda el archivo en un lugar privado.
(el respaldo automatico en Google Drive es respaldo_drive, con esta misma exportacion)
"""
import json

from django.core.management.base import BaseCommand, CommandError

from api.respaldo import ErrorRespaldo, exportar


class Command(BaseCommand):
    help = 'Escribe en pantalla un JSON con todos los documentos de la app (para respaldos)'

    def handle(self, *args, **opciones):
        try:
            datos = exportar()
        except ErrorRespaldo as e:
            raise CommandError(str(e))
        self.stdout.write(json.dumps(datos, ensure_ascii=False, indent=1))
        self.stderr.write(f'{len(datos["docs"])} documentos exportados')
