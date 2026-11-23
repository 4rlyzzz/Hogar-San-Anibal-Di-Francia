"""Carga datos de prueba en una CouchDB vacia, para que el equipo pruebe la app con algo realista.

    python manage.py datos_prueba            # muestra a que base se conecta y pide confirmar
    python manage.py datos_prueba --si       # sin preguntar (en Railway: railway ssh ... --si)
    python manage.py datos_prueba --reiniciar  # SOLO EN TU PC: borra la base local y carga todo de cero

--reiniciar (para el manual y las fotos: que todo el equipo vea lo mismo):
  borra los datos de la base local (no las bases, ni permisos ni indices), crea las cuentas del equipo
  (CUENTAS_LOCALES, con las contraseñas de CLAVES_EQUIPO en backend/.env) y carga los datos de prueba. No se crean los usuarios de
  prueba: los movimientos los registra el equipo (AREAS_LOCALES). Solo funciona con DEBUG=True:
  en Railway DEBUG es False y se niega, asi no se pueden borrar los datos reales.

Crea donadores, proveedores, compradores, productos de Alimentos, Salud e higiene y Merchandising,
y sus movimientos (ingresos, donaciones, salidas, ventas y ajustes) repartidos en las ultimas 8 semanas.
Todo pasa por las mismas vistas de la API, con sus validaciones: el stock y los lotes quedan bien.

- Solo corre sobre una base SIN productos (para no mezclar con datos reales); --forzar lo salta.
- Necesita un Administrador (crealo antes con crear_usuario). Agrega un equipo de usuarios de prueba
  (direccion, secretaria, salud, cocina, terapia) y cada movimiento lo registra alguien de esa area.
  Su contraseña: --clave, o una que se genera y se muestra al final.
- Algunos productos quedan a proposito bajo el minimo, por vencer o con un lote vencido,
  para probar las alertas, los filtros y "Dar de baja".
"""
import itertools
import os
import random
import secrets
from datetime import datetime, time as hora, timedelta
from types import SimpleNamespace
from unittest import mock

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from api import movimientos
from api.couchdb_service import COUCHDB_URL, DBS, _request, create_document, get_documents_by_type, slug
from api.movimientos import ZONA, RegistrarMovimientoView
from api.views import (
    CompradoresListCreateView, DonadoresListCreateView, InventarioListCreateView, ProveedoresListCreateView, UsuariosListCreateView,
    _clave_invalida,
)

# ---------- personas ----------
DONADORES = [
    ('ADRA Perú', '922 461 547'),
    ('Hospital Goyeneche', '975 820 224'),
    ('Hospital Honorio Delgado', '975 820 225'),
    ('Parroquia La Natividad', '948 684 226'),
    ('Colegio San José', '954 112 870'),
    ('Familia Torres Medina', '987 654 223'),
]
PROVEEDORES = [
    ('Distribuidora Andina', '954 321 876', '20456789123'),
    ('Textiles Arequipa', '958 741 236', '20512345678'),
    ('Cerámicas del Sur', '951 236 478', ''),
]
COMPRADORES = [('Rosa Quispe', '987 111 222'), ('Juan Pérez', ''), ('Carmen Ruiz', '965 432 187'), ('Parroquia Santa Marta', '054 223 344'),
               ('Colegio San José', '954 112 870')]
# niños del hogar: solo nombres de pila de ejemplo (los mismos de la app)
NINOS = ['Mateo', 'Lucía', 'Thiago', 'Valentina']

# ---------- el equipo (usuarios de la app) ----------
# (usuario, nombre, rol, area): cada movimiento lo hace alguien del area que corresponde
EQUIPO = [
    ('rosario', 'Rosario', 'Administrador', 'direccion'),
    ('secretaria', 'Elizabeth', 'Usuario', 'secretaria'),
    ('salud', 'Ruth', 'Usuario', 'salud'),
    ('cocina', 'Kenny', 'Usuario', 'cocina'),
    ('terapia', 'Revel', 'Usuario', 'terapia'),
]
# cuentas del equipo que hace el proyecto: solo con --reiniciar (en la PC de cada uno, nunca en Railway).
# Las contraseñas NO van aqui (el repositorio lo puede ver cualquiera): van en el backend/.env de cada uno,
# que no se sube a git:   CLAVES_EQUIPO=neymi:<clave>,luigi:<clave>,alan:<clave>,pochano:<clave>
# La primera es la cuenta principal (nadie le puede quitar el rol de Administrador ni desactivarla)
CUENTAS_LOCALES = [
    ('neymi', 'Neymi', 'Administrador'),
    ('luigi', 'Luigi', 'Administrador'),
    ('alan', 'Alan', 'Administrador'),
    ('pochano', 'Pochano', 'Administrador'),
]


def claves_equipo():
    """{usuario: clave} de CLAVES_EQUIPO (backend/.env). Error claro si falta alguna o no cumple las reglas."""
    texto = os.getenv('CLAVES_EQUIPO', '')
    claves = {}
    for par in texto.split(','):
        usuario, _, clave = par.strip().partition(':')
        if usuario.strip():
            claves[usuario.strip().lower()] = clave.strip()
    faltan = [u for u, *_ in CUENTAS_LOCALES if not claves.get(u)]
    if faltan:
        raise CommandError('Faltan las contraseñas de ' + ', '.join(faltan) + '. Pídelas al equipo y ponlas en backend/.env:\n'
                           '  CLAVES_EQUIPO=neymi:<clave>,luigi:<clave>,alan:<clave>,pochano:<clave>')
    for u, *_ in CUENTAS_LOCALES:
        if _clave_invalida(claves[u]):
            raise CommandError(f'CLAVES_EQUIPO, {u}: {_clave_invalida(claves[u])}')
    return claves
# con --reiniciar no se crean los usuarios de prueba (EQUIPO): los movimientos de cada area
# los registra alguien del equipo, asi en el historial aparecen ellos
AREAS_LOCALES = {'direccion': 'neymi', 'secretaria': 'luigi', 'salud': 'alan', 'terapia': 'alan', 'cocina': 'pochano'}

# quien registra cada cosa (se elige uno al azar, siempre igual para los mismos datos)
QUIEN = {
    ('Alimentos', 'ingreso'): ['secretaria', 'cocina', 'direccion'],
    ('Alimentos', 'salida'): ['cocina', 'cocina', 'secretaria'],
    ('Salud', 'ingreso'): ['salud', 'secretaria'],
    ('Salud', 'salida'): ['salud', 'salud', 'terapia'],
    ('Merchandising', 'ingreso'): ['direccion', 'secretaria'],
    ('Merchandising', 'salida'): ['secretaria', 'secretaria', 'direccion'],
    ('Alimentos', 'ajuste'): ['direccion'],
    ('Salud', 'ajuste'): ['direccion'],
}


# ---------- movimientos ----------
# dias: hace cuantos dias (0 = hoy); vence: en cuantos dias desde hoy (negativo = ya vencio)
def I(dias, cantidad, vence=None, donador=None, actividad=None):
    return ('ingreso', dias, {'cantidad': cantidad, 'vence': vence, 'donador': donador, 'actividad': actividad})


def S(dias, cantidad, para=None):
    return ('salida', dias, {'cantidad': cantidad, 'para': para})


def A(dias, contado, motivo):
    return ('ajuste', dias, {'contado': contado, 'motivo': motivo})


def C(dias, cantidad, proveedor=None, costo=None, vence=None, taller=None, comprobante=None):
    """Compra o ingreso de merchandising."""
    return ('ingreso', dias, {'cantidad': cantidad, 'proveedor': proveedor, 'costo': costo, 'vence': vence, 'taller': taller, 'comprobante': comprobante})


def V(dias, cantidad, comprador=None, medio='efectivo', comprobante=None):
    """Venta de merchandising (precio: el de la lista, con descuento si corresponde)."""
    return ('salida', dias, {'cantidad': cantidad, 'comprador': comprador, 'medio': medio, 'comprobante': comprobante})


# ---------- Alimentos ----------
# (nombre, unidad, envase (singular, contenido, medida) o None, minimo, movimientos)
ALIMENTOS = [
    ('Arroz', 'sacos', ('Saco', 50, 'kg'), 2, [I(54, 6, 300, 'ADRA Perú', 'Campaña de invierno'), S(40, 1), S(25, 1), S(10, 1), I(8, 2, 330)]),
    ('Avena tradicional', 'bolsas', ('Bolsa', 900, 'g'), 6, [I(50, 24, 160, 'Parroquia La Natividad', 'Donación libre'), S(35, 6), S(20, 6), S(6, 5)]),
    ('Chuño', 'kg', None, 5, [I(48, 20, None, 'Familia Torres Medina', 'Donación libre'), S(30, 6), S(12, 5)]),
    ('Fideos tallarín Don Vittorio', 'paquetes', ('Paquete', 500, 'g'), 10, [I(52, 40, 240, 'Colegio San José', 'Día del niño'), S(38, 10), S(22, 12), S(9, 10)]),
    ('Filete de atún', 'latas', ('Lata', 170, 'g'), 12, [I(45, 48, 700, 'ADRA Perú', 'Campaña de invierno'), S(30, 12), S(15, 12)]),
    ('Leche evaporada Gloria', 'latas', ('Lata', 400, 'g'), 24, [I(56, 96, 200, 'Parroquia La Natividad', 'Navidad'), S(42, 24), S(28, 24), S(14, 18), I(5, 48, 230)]),
    ('Leche Pura Vida', 'latas', ('Lata', 390, 'g'), 12, [I(33, 24, 180, 'Familia Torres Medina'), S(18, 6), S(4, 6)]),
    ('Papa', 'kg', None, 15, [I(21, 50, 25), S(14, 15), S(7, 15), S(2, 12)]),
    ('Tomate', 'kg', None, 4, [I(9, 12, 6), S(5, 4), S(1, 3)]),
    ('Azúcar rubia', 'kg', None, 10, [I(47, 50, 400, 'Colegio San José', 'Aniversario del hogar'), S(33, 10), S(16, 12)]),
    ('Aceite vegetal', 'botellas', ('Botella', 1, 'L'), 6, [I(44, 18, 210, 'ADRA Perú'), S(29, 4), S(11, 5)]),
    ('Lenteja', 'bolsas', ('Bolsa', 500, 'g'), 5, [I(39, 12, 260, 'Hospital Goyeneche', 'Donación libre'), S(24, 4), S(8, 5)]),
    ('Huevos', 'unidades', None, 30, [I(12, 180, 18), S(10, 60), S(6, 60), S(3, 40)]),
    ('Pollo', 'kg', None, 8, [I(6, 20, 3), S(4, 6), S(2, 5)]),
    ('Pan', 'unidades', None, 40, [I(1, 120, 2), S(0, 60)]),
    ('Sal yodada', 'bolsas', ('Bolsa', 1, 'kg'), 3, [I(53, 10, None, 'Familia Torres Medina'), S(27, 2)]),
    ('Quinua', 'bolsas', ('Bolsa', 1, 'kg'), 4, [I(36, 10, 150, 'Parroquia La Natividad', 'Campaña de invierno'), S(20, 3), S(3, 4)]),
    ('Manzana', 'kg', None, 5, [I(13, 15, -1), S(9, 5), S(5, 4)]),
]

# ---------- Salud e higiene ----------
SALUD = [
    ('Ácido valproico 250 mg/5 ml', 'frascos', ('Frasco', 120, 'ml'), 4, [I(50, 12, 420, 'Hospital Honorio Delgado', 'Donación libre'), S(30, 2, ['Mateo']), S(10, 2, ['Lucía'])]),
    ('Amitriptilina 25 mg', 'blísters', ('Blíster', 10, 'unidades'), 9, [I(55, 30, 500, 'Hospital Goyeneche'), S(40, 6, ['Thiago']), S(20, 6, ['Thiago']), S(5, 6, ['Thiago'])]),
    ('Aripiprazol 15 mg', 'blísters', ('Blíster', 10, 'unidades'), 10, [I(49, 30, 380, 'Hospital Honorio Delgado'), S(31, 6, ['Valentina']), S(12, 6, ['Valentina'])]),
    ('Carbamazepina 200 mg', 'blísters', ('Blíster', 10, 'unidades'), 20, [I(46, 40, 450, 'Hospital Goyeneche', 'Donación libre'), S(26, 10, ['Mateo', 'Lucía']), S(7, 10, ['Mateo', 'Lucía'])]),
    ('Clonazepam 2 mg', 'blísters', ('Blíster', 10, 'unidades'), 6, [I(43, 12, 360, 'Hospital Honorio Delgado'), S(22, 4, ['Valentina']), S(3, 4, ['Valentina'])]),
    ('Cloruro de sodio 0.9%', 'frascos', ('Frasco', 1000, 'ml'), 3, [I(41, 10, 600, 'ADRA Perú', 'Campaña de invierno'), S(15, 2)]),
    ('Fluoxetina 20 mg', 'blísters', ('Blíster', 10, 'unidades'), 10, [I(38, 20, 400, 'Hospital Goyeneche'), S(19, 5, ['Lucía'])]),
    ('Gasa estéril 10 x 10 cm', 'cajas', ('Caja', 20, 'unidades'), 5, [I(35, 8, 900, 'ADRA Perú'), S(17, 2), S(4, 2)]),
    ('Guantes quirúrgicos 7 1/2', 'cajas', ('Caja', 50, 'unidades'), 2, [I(52, 4, 1000, 'Hospital Honorio Delgado'), S(25, 1), S(6, 2)]),
    ('Lactulosa 3.3 g/5 ml', 'frascos', ('Frasco', 180, 'ml'), 4, [I(37, 10, 20, 'Hospital Goyeneche', 'Donación libre'), S(16, 2, ['Thiago'])]),
    ('Levetiracetam 1000 mg', 'cajas', ('Caja', 30, 'unidades'), 3, [I(44, 6, 520, 'Hospital Honorio Delgado'), S(23, 2, ['Mateo']), S(2, 2, ['Mateo'])]),
    ('Lidocaína gel 2%', 'tubos', ('Tubo', 30, 'g'), 2, [I(40, 3, 300, 'ADRA Perú'), S(18, 2)]),
    ('Pañales para adulto talla G', 'paquetes', ('Paquete', 20, 'unidades'), 10, [I(30, 25, None, 'Parroquia La Natividad', 'Maratón'), S(21, 6), S(11, 6), S(2, 5)]),
    ('Paracetamol 500 mg', 'cajas', ('Caja', 100, 'unidades'), 2, [I(42, 5, 640, 'Hospital Goyeneche', 'Donación libre'), S(28, 1), S(9, 1)]),
    ('Suero oral Suerox', 'botellas', ('Botella', 630, 'ml'), 5, [I(34, 15, -2, 'Colegio San José', 'Día del niño'), S(13, 5)]),
    ('Sulpirida 200 mg', 'blísters', ('Blíster', 10, 'unidades'), 5, [I(32, 12, 410, 'Hospital Honorio Delgado'), S(14, 3, ['Valentina'])]),
    ('Valproato de sodio 500 mg', 'blísters', ('Blíster', 10, 'unidades'), 12, [I(51, 40, 480, 'Hospital Goyeneche', 'Donación libre'), S(30, 10, ['Lucía']), S(9, 10, ['Lucía'])]),
    ('Pasta dental Colgate', 'tubos', ('Tubo', 90, 'g'), 10, [I(29, 24, 700, 'Familia Torres Medina', 'Aniversario del hogar'), S(15, 8), S(1, 8)]),
    ('Jabón de tocador', 'unidades', None, 20, [I(27, 48, None, 'Colegio San José'), S(13, 15), S(3, 12)]),
    ('Alcohol 70°', 'frascos', ('Frasco', 1000, 'ml'), 3, [I(26, 6, 720, 'ADRA Perú'), S(8, 2), A(0, 3, 'Salida no registrada')]),
]

# ---------- Merchandising ----------
# (datos del producto para la API, movimientos)
MERCH = [
    ({'tipoMerch': 'paneton', 'nombre': 'Panetón Clásico', 'marca': "D'Onofrio", 'presentacion': 'caja 900 g',
      'precio': 35, 'descuentoDesde': 6, 'precioDescuento': 32, 'minimo': 6},
     [C(30, 48, 'Distribuidora Andina', 26, 95, comprobante=('factura', 'F001-2045')),
      V(25, 6, 'Parroquia Santa Marta', 'transferencia', ('boleta', 'B001-0101')), V(18, 3, 'Rosa Quispe', 'yape-plin'),
      V(9, 12, 'Colegio San José', 'transferencia', ('factura', 'F001-0033')), V(2, 4, 'Carmen Ruiz', 'efectivo')]),
    ({'tipoMerch': 'paneton', 'nombre': 'Panetón', 'marca': 'Todinno', 'presentacion': 'caja 900 g', 'precio': 28, 'minimo': 4},
     [C(28, 24, 'Distribuidora Andina', 20, 80, comprobante=('factura', 'F001-2046')), V(15, 5, 'Juan Pérez', 'yape-plin'), V(4, 3, None, 'efectivo')]),
    ({'tipoMerch': 'promocional', 'subcategoria': 'prendas', 'nombre': 'Polo Hogar', 'articulo': 'polo', 'talla': 'M', 'color': 'Azul',
      'unidad': 'unidades', 'precio': 30, 'minimo': 3, 'material': 'algodón'},
     [C(40, 15, 'Textiles Arequipa', 15), V(33, 2, 'Juan Pérez', 'efectivo'), V(12, 3, 'Rosa Quispe', 'yape-plin')]),
    ({'tipoMerch': 'promocional', 'subcategoria': 'prendas', 'nombre': 'Polo Hogar', 'articulo': 'polo', 'talla': 'L', 'color': 'Azul',
      'unidad': 'unidades', 'precio': 30, 'minimo': 3, 'material': 'algodón'},
     [C(40, 10, 'Textiles Arequipa', 15), V(20, 4, 'Carmen Ruiz', 'efectivo'), V(6, 4, None, 'yape-plin')]),
    ({'tipoMerch': 'promocional', 'subcategoria': 'prendas', 'nombre': 'Polo Hogar', 'articulo': 'polo', 'talla': 'S', 'color': 'Blanco',
      'unidad': 'unidades', 'precio': 28, 'minimo': 3},
     [C(40, 8, 'Textiles Arequipa', 14), V(22, 1, 'Rosa Quispe', 'efectivo')]),
    ({'tipoMerch': 'promocional', 'subcategoria': 'prendas', 'nombre': 'Gorra Hogar', 'articulo': 'gorra', 'talla': 'única', 'color': 'Azul',
      'unidad': 'unidades', 'precio': 18, 'minimo': 4},
     [C(38, 12, 'Textiles Arequipa', 8), V(17, 3, 'Juan Pérez', 'efectivo')]),
    ({'tipoMerch': 'promocional', 'subcategoria': 'general', 'nombre': 'Taza Hogar San Aníbal', 'articulo': 'taza',
      'unidad': 'unidades', 'precio': 15, 'minimo': 5, 'diseno': 'logo del hogar'},
     [C(45, 24, 'Cerámicas del Sur', 7), V(31, 4, 'Parroquia Santa Marta', 'efectivo'), V(10, 2, 'Carmen Ruiz', 'yape-plin')]),
    ({'tipoMerch': 'promocional', 'subcategoria': 'general', 'nombre': 'Tomatodo Hogar', 'articulo': 'tomatodo',
      'unidad': 'unidades', 'precio': 20, 'minimo': 4},
     [C(26, 10, 'Cerámicas del Sur', 11), V(8, 2, 'Rosa Quispe', 'efectivo')]),
    ({'tipoMerch': 'hogar', 'subcategoria': 'general', 'nombre': 'Rosario de madera', 'articulo': 'rosario',
      'unidad': 'unidades', 'precio': 8, 'minimo': 5},
     [C(35, 20, taller='Taller de manualidades'), V(24, 5, 'Parroquia Santa Marta', 'efectivo'), V(5, 6, 'Rosa Quispe', 'yape-plin')]),
    ({'tipoMerch': 'hogar', 'subcategoria': 'general', 'nombre': 'Tarjeta navideña', 'articulo': 'tarjeta', 'variante': 'con sobre',
      'unidad': 'packs', 'precio': 10, 'minimo': 3},
     [C(20, 15, taller='Taller de manualidades'), V(7, 4, 'Colegio San José', 'efectivo')]),
    ({'tipoMerch': 'hogar', 'subcategoria': 'alimentos', 'nombre': 'Mermelada de fresa', 'presentacion': 'frasco 300 g', 'perecible': True,
      'unidad': 'unidades', 'precio': 12, 'minimo': 4},
     [C(16, 12, vence=60, taller='Taller de cocina'), V(9, 4, 'Carmen Ruiz', 'efectivo'), V(3, 5, 'Juan Pérez', 'yape-plin')]),
    ({'tipoMerch': 'hogar', 'subcategoria': 'alimentos', 'nombre': 'Alfajores de maicena', 'presentacion': 'caja 6 unidades', 'perecible': True,
      'unidad': 'unidades', 'precio': 9, 'minimo': 5},
     [C(6, 15, vence=5, taller='Taller de cocina'), V(4, 6, 'Rosa Quispe', 'efectivo'), V(1, 4, None, 'efectivo')]),
]


class Command(BaseCommand):
    help = 'Carga datos de prueba (donadores, productos y movimientos de las ultimas 8 semanas) en una CouchDB sin productos'

    def add_arguments(self, parser):
        parser.add_argument('--si', action='store_true', help='No pedir confirmacion')
        parser.add_argument('--forzar', action='store_true', help='Cargar aunque ya haya productos (los que ya existen se saltan)')
        parser.add_argument('--clave', help='Contraseña de los usuarios de prueba (si no, se genera una y se muestra al final)')
        parser.add_argument('--reiniciar', action='store_true',
                            help='SOLO LOCAL (DEBUG=True): borra los datos de la base, crea las cuentas del equipo y carga todo de cero')

    def handle(self, *args, si=False, forzar=False, clave=None, reiniciar=False, **opciones):
        if reiniciar:
            self._reiniciar(si)
            si = True  # ya se confirmo al borrar
        productos, status = get_documents_by_type('producto')
        if status != 200:
            raise CommandError(f'No se pudo leer la base ({status}): ¿corrio setup_couch? ¿esta encendida CouchDB?')
        if productos and not forzar:
            raise CommandError(f'La base ya tiene {len(productos)} productos: esto es para una base vacia. '
                               'Si de verdad quieres agregar los de prueba, usa --forzar (los que ya existen se saltan).')

        self.usuario = self._responsable()
        if clave and _clave_invalida(clave):
            raise CommandError(f'--clave: {_clave_invalida(clave)}')
        self.stdout.write(f'Base: {COUCHDB_URL}')
        if reiniciar:
            self.stdout.write('Los movimientos los registran las cuentas del equipo (no se crean usuarios de prueba).')
        else:
            self.stdout.write(f'Administrador: {self.usuario.nombre}. Se agregan {len(EQUIPO)} usuarios de prueba que registran los movimientos.')
        if not si and input('¿Cargar los datos de prueba? [s/N] ').strip().lower() not in ('s', 'si', 'sí'):
            raise CommandError('Cancelado: no se cargo nada')

        self.fabrica = APIRequestFactory()
        self.azar = random.Random(2026)
        self.canales = itertools.cycle(['manual', 'manual', 'voz', 'manual', 'codigo', 'voz'])
        self.ahora = datetime.now(ZONA)
        self.errores = 0

        # el equipo: los que ya existen se usan tal cual (no se les cambia la contraseña)
        clave_generada = None
        nuevos = []
        if not reiniciar:
            if not clave:
                clave = clave_generada = f'prueba{secrets.randbelow(9000) + 1000}{secrets.token_hex(2)}'
            nuevos = [u for u, nombre, rol, _ in EQUIPO
                      if self._post(UsuariosListCreateView, '/api/usuarios/', {'usuario': u, 'nombre': nombre, 'rol': rol, 'clave': clave}, saltar_repetido=True)]
            self.stdout.write(f'Usuarios: {len(nuevos)} nuevos')
        self.equipo = self._equipo(AREAS_LOCALES if reiniciar else None)

        for vista, nombre, lista in (
            (DonadoresListCreateView, 'donadores', [{'nombre': n, 'telefono': t} for n, t in DONADORES]),
            (ProveedoresListCreateView, 'proveedores', [{'nombre': n, 'telefono': t, 'ruc': r} for n, t, r in PROVEEDORES]),
            (CompradoresListCreateView, 'compradores', [{'nombre': n, 'telefono': t} for n, t in COMPRADORES]),
        ):
            hechos = sum(1 for datos in lista if self._post(vista, f'/api/{nombre}/', datos, saltar_repetido=True))
            self.stdout.write(f'{nombre.capitalize()}: {hechos} nuevos')

        # todos los movimientos, del mas antiguo al mas nuevo (asi las salidas encuentran su stock)
        eventos = []
        for categoria, lista in (('Alimentos', ALIMENTOS), ('Salud', SALUD)):
            for nombre, unidad, envase, minimo, movs in lista:
                datos = {'categoria': categoria, 'nombre': nombre, 'unidad': unidad, 'stock_minimo': minimo}
                if envase:
                    datos.update(envase=envase[0], contenido=envase[1], medida=envase[2])
                eventos += self._crear(datos, movs, merch=False)
        for datos, movs in MERCH:
            eventos += self._crear({'categoria': 'Merchandising', **datos}, movs, merch=True)

        for orden, (dias, producto_id, nombre, categoria, tipo, datos) in enumerate(sorted(eventos, key=lambda e: -e[0])):
            self._movimiento(dias, orden, producto_id, nombre, categoria, tipo, datos)

        self.stdout.write(f'Productos: {len(ALIMENTOS)} de Alimentos, {len(SALUD)} de Salud, {len(MERCH)} de Merchandising')
        self.stdout.write(f'Movimientos: {len(eventos)}')
        if self.errores:
            raise CommandError(f'Terminó con {self.errores} errores (ver arriba)')
        self.stdout.write(self.style.SUCCESS('Datos de prueba cargados.'))
        if nuevos:
            self.stdout.write(f'Usuarios de prueba: {", ".join(nuevos)}')
            if clave_generada:
                # solo se muestra aqui, en la consola de quien lo corrio
                self.stdout.write(f'Contraseña de todos ellos: {clave_generada}  (cámbiala desde la app si hace falta)')
        if reiniciar:
            self.stdout.write('Cuentas del equipo: ' + ', '.join(u for u, *_ in CUENTAS_LOCALES) + ' (con las contraseñas de CLAVES_EQUIPO)')

    # ---------- --reiniciar (solo local) ----------
    def _reiniciar(self, si):
        """Deja la base LOCAL vacia (sin tocar bases, permisos ni indices) y crea las cuentas del equipo."""
        if not settings.DEBUG:
            raise CommandError('--reiniciar solo funciona en tu PC (DEBUG=True en backend/.env). '
                               'Aqui DEBUG es False: puede ser la base real (Railway) y no se borra nada.')
        # antes de borrar: si faltan las contraseñas no se toca nada
        claves = claves_equipo()
        self.stdout.write(f'Base: {COUCHDB_URL}')
        self.stdout.write(self.style.WARNING('Se BORRAN todos los usuarios, productos, movimientos, donadores, proveedores y compradores de esta base.'))
        if not si and input('¿Borrar todo y cargar los datos de prueba? [s/N] ').strip().lower() not in ('s', 'si', 'sí'):
            raise CommandError('Cancelado: no se borro nada')

        for base in DBS.values():
            datos, status = _request('GET', f'{COUCHDB_URL}/{base}/_all_docs')
            if status != 200:
                raise CommandError(f'No se pudo leer {base} ({status}): ¿corrio setup_couch? ¿esta encendida CouchDB?')
            # los _design son los indices: se quedan
            borrar = [{'_id': f['id'], '_rev': f['value']['rev'], '_deleted': True}
                      for f in datos.get('rows', []) if not f['id'].startswith('_design/')]
            if borrar:
                _, status = _request('POST', f'{COUCHDB_URL}/{base}/_bulk_docs', json={'docs': borrar})
                if status not in (200, 201):
                    raise CommandError(f'No se pudo vaciar {base} ({status})')
            self.stdout.write(f'  {base}: {len(borrar)} borrados')

        # igual que crear_usuario: la primera cuenta es la principal
        ahora = datetime.now(ZONA).isoformat()
        for i, (usuario, nombre, rol) in enumerate(CUENTAS_LOCALES):
            clave = claves[usuario]
            _, status = create_document({
                'tipo': 'usuario', 'usuario': usuario, 'nombre': nombre, 'rol': rol, 'activo': True,
                'clave': make_password(clave), 'creado': ahora, 'principal': i == 0,
            }, f'usuario:{slug(usuario)}')
            if status not in (200, 201):
                raise CommandError(f'No se pudo crear la cuenta {usuario} ({status})')
        self.stdout.write(f'Cuentas del equipo: {len(CUENTAS_LOCALES)} creadas')

    # ---------- partes ----------
    def _responsable(self):
        cuentas, status = get_documents_by_type('usuario')
        admins = [c for c in (cuentas if status == 200 else []) if c.get('rol') == 'Administrador' and c.get('activo', True)]
        if not admins:
            raise CommandError('No hay ningun Administrador: crealo primero con "python manage.py crear_usuario"')
        return self._cuenta(admins[0])

    @staticmethod
    def _cuenta(c):
        return SimpleNamespace(is_authenticated=True, pk=c['_id'], id=c['_id'], nombre=c.get('nombre') or c.get('usuario'), rol=c.get('rol'))

    def _equipo(self, areas=None):
        """area -> cuenta (la de la base: con su id, asi la pestaña Usuarios cuenta sus movimientos).
        areas: {area: usuario} para usar otras cuentas (--reiniciar: las del equipo del proyecto)."""
        cuentas, _ = get_documents_by_type('usuario')
        por_usuario = {str(c.get('usuario', '')).lower(): c for c in cuentas}
        quien = areas or {area: u for u, _, _, area in EQUIPO}
        equipo = {area: self._cuenta(por_usuario[u]) for area, u in quien.items() if u in por_usuario}
        # si alguno no se pudo crear, lo hace el administrador
        return {area: equipo.get(area, self.usuario) for *_, area in EQUIPO}

    def _post(self, vista, ruta, datos, saltar_repetido=False, usuario=None):
        req = self.fabrica.post(ruta, datos, format='json')
        force_authenticate(req, user=usuario or self.usuario)
        # sin el limite de peticiones: no es una persona, y su contador va en la cache de archivos.
        # Con "railway ssh" esto corre como root: los archivos de cache que creara serian de root
        # y la app (que corre como otro usuario) no podria leerlos (error 500 en todo)
        with mock.patch.object(APIView, 'get_throttles', return_value=[]):
            r = vista.as_view()(req)
        if r.status_code in (200, 201):
            return r.data
        if not (saltar_repetido and r.status_code == 409):
            self.errores += 1
            self.stderr.write(f'  ERROR {ruta} {datos.get("nombre") or datos.get("tipo")}: {r.status_code} {r.data}')
        return None

    def _crear(self, datos, movs, merch):
        """Crea el producto y devuelve sus movimientos por registrar; si ya existia, nada (no se duplica)."""
        creado = self._post(InventarioListCreateView, '/api/inventario/', datos, saltar_repetido=True)
        if not creado:
            self.stdout.write(f'  ya existe, se salta: {datos["nombre"]}')
            return []
        producto_id = creado.get('id') or creado.get('_id')
        return [(dias, producto_id, datos['nombre'], datos['categoria'], tipo, d) for tipo, dias, d in movs]

    def _momento(self, dias, orden):
        """Ese dia a una hora de trabajo (8:00 a 17:59), en hora de Peru; los de hoy, antes de ahora."""
        dia = (self.ahora - timedelta(days=dias)).date()
        momento = datetime.combine(dia, hora(8 + self.azar.randrange(10), self.azar.randrange(60)), ZONA)
        if dias == 0:
            momento = min(momento, self.ahora - timedelta(minutes=30 - orden % 30))
        return momento

    def _movimiento(self, dias, orden, producto_id, nombre, categoria, tipo, d):
        merch = categoria == 'Merchandising'
        hoy = self.ahora.date()
        quien = self.equipo[self.azar.choice(QUIEN[(categoria, tipo)])]
        peticion = {'tipo': tipo, 'producto_id': producto_id, 'canal': next(self.canales)}
        if tipo == 'ajuste':
            peticion.update(contado=d['contado'], motivo=d['motivo'], nota='Conteo de fin de mes')
        else:
            peticion['cantidad'] = d['cantidad']
        if tipo == 'ingreso':
            if d.get('vence') is not None:
                peticion['vence'] = (hoy + timedelta(days=d['vence'])).isoformat()
            if merch:
                peticion.update(proveedor=d.get('proveedor') or '', costo_unitario=d.get('costo'), taller=d.get('taller') or '')
                if d.get('comprobante'):
                    peticion.update(comprobante_tipo=d['comprobante'][0], comprobante_numero=d['comprobante'][1])
            elif d.get('donador'):
                peticion.update(donador=d['donador'], actividad=d.get('actividad') or '')
        if tipo == 'salida':
            if merch:
                peticion.update(comprador=d.get('comprador') or '', medio_pago=d.get('medio') or '')
                if d.get('comprobante'):
                    peticion.update(comprobante_tipo=d['comprobante'][0], comprobante_numero=d['comprobante'][1])
            elif d.get('para'):
                peticion['para'] = d['para']
        # el backend cree que "ahora" es ese dia: asi la fecha, el lote y la revision del vencimiento cuadran
        momento = self._momento(dias, orden)
        with mock.patch.object(movimientos, '_ahora', return_value=momento.astimezone(movimientos.timezone.utc)), \
                mock.patch.object(movimientos, '_hoy', return_value=momento.date()):
            hecho = self._post(RegistrarMovimientoView, '/api/movimientos/', {**peticion, 'nombre': nombre}, usuario=quien)
        if hecho:
            self.stdout.write(f'  {momento:%d/%m} {tipo:8} {quien.nombre:10} {nombre}')
