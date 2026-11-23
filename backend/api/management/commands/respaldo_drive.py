"""Sube un respaldo de la base al Google Drive del Hogar y borra los que ya sobran.

    python manage.py respaldo_drive              # en Railway lo corre el servicio "respaldo" (cron)
    python manage.py respaldo_drive --sin-borrar  # sube y no borra ninguno

Necesita DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET y DRIVE_REFRESH_TOKEN (de autorizar_drive) y las
variables de CouchDB del backend. El archivo se llama respaldo-AAAA-MM-DD_HHMM.json.gz (hora de Lima)
y queda en la carpeta DRIVE_CARPETA. Cuantos se guardan: ver api/respaldo.py.

Para restaurar: bajar el archivo de Drive, descomprimirlo (7-Zip o "gzip -d") y
    python manage.py setup_couch --datos respaldo-AAAA-MM-DD_HHMM.json   (en una CouchDB vacia)
Si falla, termina con error: Railway lo marca como fallido en el historial del cron.
"""
from datetime import datetime

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api import respaldo
from api.respaldo import ErrorRespaldo


class Command(BaseCommand):
    help = 'Sube un respaldo de la base a Google Drive y borra los que sobran'

    def add_arguments(self, parser):
        parser.add_argument('--sin-borrar', action='store_true', help='Sube el respaldo sin borrar los viejos')

    def handle(self, *args, sin_borrar=False, **opciones):
        try:
            self._respaldar(sin_borrar)
        except ErrorRespaldo as e:
            raise CommandError(f'No se hizo el respaldo: {e}')

    def _respaldar(self, sin_borrar):
        # primero el acceso a Drive: si falta, no se lee la base para nada
        token = respaldo.token_acceso(settings.DRIVE_CLIENT_ID, settings.DRIVE_CLIENT_SECRET, settings.DRIVE_REFRESH_TOKEN)
        drive = respaldo.Drive(token)

        ahora = datetime.now(respaldo.ZONA)
        datos = respaldo.exportar()
        contenido = respaldo.comprimir(datos)
        nombre = respaldo.nombre_respaldo(ahora)

        carpeta = drive.carpeta(settings.DRIVE_CARPETA)
        drive.subir(nombre, contenido, carpeta)
        self.stdout.write(f'Subido {nombre}: {len(datos["docs"])} documentos, {len(contenido) / 1024:.1f} KB')

        if sin_borrar:
            return
        archivos = drive.listar(carpeta)
        sobran = respaldo.que_borrar(
            archivos, ahora, diarios=settings.RESPALDO_DIARIOS, semanales=settings.RESPALDO_SEMANALES,
            mensuales=settings.RESPALDO_MENSUALES, horas=settings.RESPALDO_HORAS,
        )
        nombres = {a['id']: a['name'] for a in archivos}
        for ident in sobran:
            drive.borrar(ident)
            self.stdout.write(f'Borrado {nombres.get(ident, ident)}')
        self.stdout.write(f'En Drive quedan {len(archivos) - len(sobran)} respaldos')
