from datetime import datetime, timezone
from getpass import getpass

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

from api.couchdb_service import create_document, get_documents_by_type
from api.views import _clave_invalida


class Command(BaseCommand):
    help = 'Crea un usuario en CouchDB (sirve para el primer administrador)'

    def add_arguments(self, parser):
        parser.add_argument('--usuario', help='nombre para iniciar sesion')
        parser.add_argument('--nombre', help='nombre que se muestra en la app')
        parser.add_argument('--rol', default='Administrador', choices=['Administrador', 'Usuario'])

    def handle(self, *args, **opciones):
        usuario = (opciones['usuario'] or input('Usuario: ')).strip().lower()
        nombre = (opciones['nombre'] or input('Nombre: ')).strip() or usuario
        if not usuario:
            raise CommandError('El usuario es obligatorio')

        clave = getpass('Contraseña: ')
        error = _clave_invalida(clave)
        if error:
            raise CommandError(error)
        if clave != getpass('Repite la contraseña: '):
            raise CommandError('Las contraseñas no coinciden')

        existentes, status = get_documents_by_type('usuario')
        if status != 200:
            raise CommandError('No se pudo conectar con CouchDB')
        if any((d.get('usuario') or '').lower() == usuario for d in existentes):
            raise CommandError('Ese usuario ya existe')

        _, status = create_document({
            'tipo': 'usuario',
            'usuario': usuario,
            'nombre': nombre,
            'rol': opciones['rol'],
            'activo': True,
            'clave': make_password(clave),
            'creado': datetime.now(timezone.utc).isoformat(),
            # el primer administrador es la cuenta principal: nadie le puede cambiar el rol ni desactivarla
            'principal': opciones['rol'] == 'Administrador' and not any(d.get('rol') == 'Administrador' for d in existentes),
        })
        if status not in (200, 201):
            raise CommandError('CouchDB no guardó el usuario')
        self.stdout.write(self.style.SUCCESS(f'Usuario "{usuario}" creado como {opciones["rol"]}'))
