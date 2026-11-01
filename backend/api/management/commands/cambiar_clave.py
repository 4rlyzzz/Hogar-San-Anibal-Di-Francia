from getpass import getpass

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

from api.couchdb_service import get_documents_by_type, update_document
from api.views import _clave_invalida


class Command(BaseCommand):
    help = 'Pone una contraseña nueva a una cuenta (para recuperar la del administrador principal)'

    def add_arguments(self, parser):
        parser.add_argument('--usuario', help='usuario con el que se inicia sesion')

    def handle(self, *args, **opciones):
        usuario = (opciones['usuario'] or input('Usuario: ')).strip().lower()

        cuentas, status = get_documents_by_type('usuario')
        if status != 200:
            raise CommandError('No se pudo conectar con CouchDB')
        cuenta = next((d for d in cuentas if (d.get('usuario') or '').lower() == usuario), None)
        if not cuenta:
            raise CommandError('Ese usuario no existe')

        clave = getpass('Contraseña nueva: ')
        error = _clave_invalida(clave)
        if error:
            raise CommandError(error)
        if clave != getpass('Repite la contraseña: '):
            raise CommandError('Las contraseñas no coinciden')

        _, status = update_document(cuenta['_id'], {'clave': make_password(clave)}, None, 'usuario', fusionar=True)
        if status not in (200, 201):
            raise CommandError('CouchDB no guardó la contraseña')
        self.stdout.write(self.style.SUCCESS(f'Contraseña de "{usuario}" cambiada'))
