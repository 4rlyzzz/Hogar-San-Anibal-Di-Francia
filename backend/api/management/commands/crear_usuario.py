from getpass import getpass

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

from api.couchdb_service import create_document, get_documents_by_type


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
        if len(clave) < 8:
            raise CommandError('La contraseña debe tener al menos 8 caracteres')
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
        })
        if status not in (200, 201):
            raise CommandError('CouchDB no guardó el usuario')
        self.stdout.write(self.style.SUCCESS(f'Usuario "{usuario}" creado como {opciones["rol"]}'))
