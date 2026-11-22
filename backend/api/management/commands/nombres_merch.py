"""Quita la presentacion del nombre de los productos de merchandising creados antes del cambio.

    python manage.py nombres_merch          # muestra lo que cambiaria, sin guardar
    python manage.py nombres_merch --si     # lo guarda

"Panetón Clásico D'Onofrio caja 900 g" pasa a "Panetón Clásico D'Onofrio" (la presentacion ya se muestra aparte).
Si hay otro producto con ese mismo nombre (otro tamaño), se deja como esta: ahi la presentacion los distingue.
El nombre viejo queda en 'unidos': los movimientos guardados con ese nombre siguen apareciendo en su historial.
"""
from django.core.management.base import BaseCommand, CommandError

from api import merch
from api.couchdb_service import actualizar_con_reintento, get_documents_by_type, slug


class Command(BaseCommand):
    help = 'Quita la presentacion del nombre de los productos de merchandising (los de antes del cambio)'

    def add_arguments(self, parser):
        parser.add_argument('--si', action='store_true', help='Guardar los cambios (sin esto solo los muestra)')

    def handle(self, *args, si=False, **opciones):
        productos, status = get_documents_by_type('producto')
        if status != 200:
            raise CommandError(f'No se pudo leer la base ({status})')
        todos = [p for p in productos if merch.es_merch(p) and p.get('nombreBase') and p.get('tipoMerch')]

        # nombre corto -> cuantos productos lo tendrian (con 2 o mas, la presentacion los distingue)
        cortos = {}
        for p in todos:
            cortos.setdefault(slug(merch.nombre_completo(p)), []).append(p)

        cambios = []
        for p in todos:
            corto = merch.nombre_completo(p)
            if p['nombre'] != corto and len(cortos[slug(corto)]) == 1:
                cambios.append((p, corto))

        if not cambios:
            self.stdout.write('No hay nombres que acortar.')
            return
        for p, corto in cambios:
            self.stdout.write(f'  "{p["nombre"]}" -> "{corto}"')
        if not si:
            self.stdout.write(f'{len(cambios)} por cambiar. Para guardarlos: python manage.py nombres_merch --si')
            return

        errores = 0
        for p, corto in cambios:
            viejo = p['nombre']
            _, status = actualizar_con_reintento(p['_id'], 'producto', lambda doc: {
                'nombre': corto,
                'unidos': list(dict.fromkeys([*(doc.get('unidos') or []), viejo])),
            })
            if status != 200:
                errores += 1
                self.stderr.write(f'  ERROR "{viejo}": {status}')
        if errores:
            raise CommandError(f'{errores} no se pudieron cambiar')
        self.stdout.write(self.style.SUCCESS(f'{len(cambios)} nombres acortados.'))
