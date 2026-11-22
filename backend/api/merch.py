import math
import re

from .couchdb_service import nombre_propio, slug

CATEGORIA = 'merchandising'
NOMBRE_CATEGORIA = 'Merchandising'

TIPOS = ('paneton', 'hogar', 'promocional')
SUBCATEGORIAS = {'paneton': (None,), 'hogar': ('general', 'alimentos'), 'promocional': ('general', 'prendas')}
UNIDADES = ('unidades', 'packs', 'docenas')
ARTICULOS = {
    ('hogar', 'general'): ('rosario', 'taza', 'llavero', 'tarjeta', 'manualidad', 'otro'),
    ('promocional', 'general'): ('taza', 'lapicero', 'tomatodo', 'llavero', 'otro'),
    ('promocional', 'prendas'): ('polo', 'casaca', 'gorra', 'chalina', 'otro'),
}
TALLAS = ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'única')
COMPROBANTES = ('boleta', 'factura')
MEDIOS_PAGO = ('efectivo', 'yape-plin', 'transferencia')

DINERO_MAXIMO = 100000
LARGO_NOMBRE = 60


class DatoInvalido(Exception):
    pass


def es_merch(producto):
    return str((producto or {}).get('categoria', '')).lower() == CATEGORIA


def _texto(valor, maximo):
    if not isinstance(valor, (str, int, float)) or isinstance(valor, bool):
        return ''
    return ' '.join(str(valor).split())[:maximo]


def _obligatorio(datos, campo, maximo, que):
    valor = _texto(datos.get(campo), maximo)
    if not valor:
        raise DatoInvalido(f'Falta {que}')
    return valor


def _opcion(valor, opciones, que):
    if valor not in opciones:
        raise DatoInvalido(f'Elige {que} de la lista')
    return valor


def dinero(valor, que, obligatorio=True, mayor_que_cero=True):
    if valor in (None, ''):
        if obligatorio:
            raise DatoInvalido(f'Falta {que}')
        return None
    if isinstance(valor, bool):
        raise DatoInvalido(f'{que.capitalize()} tiene que ser un número')
    try:
        n = float(str(valor).replace(',', '.'))
    except (TypeError, ValueError):
        raise DatoInvalido(f'{que.capitalize()} tiene que ser un número')
    if not math.isfinite(n) or n < 0 or (mayor_que_cero and n == 0):
        raise DatoInvalido(f'{que.capitalize()} tiene que ser mayor que 0')
    if n > DINERO_MAXIMO:
        raise DatoInvalido(f'{que.capitalize()} no puede ser mayor que {DINERO_MAXIMO}')
    if round(n, 2) != n:
        raise DatoInvalido(f'{que.capitalize()} puede tener hasta 2 decimales')
    return n


def _entero(valor, que, minimo=1, obligatorio=False):
    if valor in (None, ''):
        if obligatorio:
            raise DatoInvalido(f'Falta {que}')
        return None
    try:
        n = float(valor)
    except (TypeError, ValueError):
        raise DatoInvalido(f'{que.capitalize()} tiene que ser un número entero')
    if isinstance(valor, bool) or not math.isfinite(n) or n != int(n) or n < minimo or n > 100000:
        raise DatoInvalido(f'{que.capitalize()} tiene que ser un número entero de {minimo} o más')
    return int(n)


def nombre_completo(doc):
    """El nombre con lo que distingue al producto: la marca del panetón, la variante, la talla y el color.

    La presentacion ("caja 900 g") no va: ya se muestra aparte. Solo se agrega si hay otro con el mismo
    nombre y otra presentacion (ver con_presentacion), como en Alimentos y Salud.
    """
    partes = [doc['nombreBase']]
    base = doc['nombreBase'].lower()
    tipo, sub = doc['tipoMerch'], doc.get('subcategoria')
    if tipo == 'paneton':
        if doc['marca'].lower() not in base:
            partes.append(doc['marca'])
    elif tipo == 'hogar' and doc.get('variante'):
        partes.append(doc['variante'])
    elif tipo == 'promocional' and sub == 'prendas':
        partes += [f"talla {doc['talla']}", doc['color']]
    return ' '.join(' '.join(partes).split())


def con_presentacion(doc):
    """El nombre con su presentacion al final ("Panetón Clásico D'Onofrio caja 500 g"), o None si no tiene."""
    if not doc.get('presentacion'):
        return None
    return ' '.join(f"{nombre_completo(doc)} {doc['presentacion']}".split())


def _descuento(doc):
    desde, precio = doc.get('descuentoDesde'), doc.get('precioDescuento')
    if desde is None and precio is None:
        return
    if desde is None:
        raise DatoInvalido('Falta desde cuántas unidades va el descuento')
    if precio is None:
        raise DatoInvalido('Falta el precio con descuento')
    if precio >= doc['precio']:
        raise DatoInvalido('El precio con descuento tiene que ser menor que el precio de venta')


def producto_desde(datos):
    tipo = _opcion(datos.get('tipoMerch'), TIPOS, 'el tipo de merchandising')
    sub = datos.get('subcategoria') if tipo != 'paneton' else None
    _opcion(sub, SUBCATEGORIAS[tipo], 'la subcategoría')

    doc = {
        'tipoMerch': tipo,
        'subcategoria': sub,
        'nombreBase': _obligatorio(datos, 'nombre', LARGO_NOMBRE, 'el nombre'),
        'precio': dinero(datos.get('precio'), 'el precio de venta'),
        'descripcion': _texto(datos.get('descripcion'), 200),
    }
    if tipo == 'paneton':
        doc['unidad'] = 'unidades'
        doc['marca'] = _obligatorio(datos, 'marca', 40, 'la marca')
        doc['presentacion'] = _obligatorio(datos, 'presentacion', 40, 'la presentación')
        doc['descuentoDesde'] = _entero(datos.get('descuentoDesde'), 'la cantidad mínima para descuento', minimo=2)
        doc['precioDescuento'] = dinero(datos.get('precioDescuento'), 'el precio con descuento', obligatorio=False)
        _descuento(doc)
    else:
        doc['unidad'] = _opcion(datos.get('unidad'), UNIDADES, 'la unidad de venta')

    if (tipo, sub) in ARTICULOS:
        doc['articulo'] = _opcion(datos.get('articulo'), ARTICULOS[(tipo, sub)], 'el tipo de artículo')
    if tipo == 'hogar' and sub == 'general':
        doc['variante'] = _texto(datos.get('variante'), 30)
    if tipo == 'hogar' and sub == 'alimentos':
        doc['presentacion'] = _obligatorio(datos, 'presentacion', 40, 'la presentación')
        if not isinstance(datos.get('perecible'), bool):
            raise DatoInvalido('Indica si es perecible')
        doc['perecible'] = datos['perecible']
    if tipo == 'promocional':
        doc['diseno'] = _texto(datos.get('diseno'), 60)
    if tipo == 'promocional' and sub == 'prendas':
        doc['talla'] = _opcion(datos.get('talla'), TALLAS, 'la talla')
        doc['color'] = _obligatorio(datos, 'color', 20, 'el color')
        doc['material'] = _texto(datos.get('material'), 30)

    doc['nombre'] = nombre_completo(doc)
    if len(doc['nombre']) > LARGO_NOMBRE:
        raise DatoInvalido(f"Con sus datos el nombre quedaría \"{doc['nombre']}\", que es muy largo: acórtalo")
    return doc


CAMPOS_EDITABLES = ('precio', 'descuentoDesde', 'precioDescuento', 'descripcion', 'diseno', 'material')


def cambios_producto(actual, datos):
    cambios = {}
    if 'precio' in datos:
        cambios['precio'] = dinero(datos['precio'], 'el precio de venta')
    if actual.get('tipoMerch') == 'paneton':
        if 'descuentoDesde' in datos:
            cambios['descuentoDesde'] = _entero(datos['descuentoDesde'], 'la cantidad mínima para descuento', minimo=2)
        if 'precioDescuento' in datos:
            cambios['precioDescuento'] = dinero(datos['precioDescuento'], 'el precio con descuento', obligatorio=False)
    for campo, maximo in (('descripcion', 200), ('diseno', 60), ('material', 30)):
        if campo in datos:
            cambios[campo] = _texto(datos[campo], maximo)
    _descuento({**actual, **cambios})
    return cambios


def clave_nombre(nombre):
    return slug(nombre)


def vence_ingreso(producto, vence):
    tipo = producto.get('tipoMerch')
    pide = tipo == 'paneton' or (tipo == 'hogar' and producto.get('subcategoria') == 'alimentos' and producto.get('perecible'))
    puede = pide or (tipo == 'hogar' and producto.get('subcategoria') == 'alimentos')
    if pide and not vence:
        raise DatoInvalido('Falta la fecha de vencimiento')
    return vence if puede else None


def _comprobante(datos):
    tipo = datos.get('comprobante_tipo') or ''
    if tipo and tipo not in COMPROBANTES:
        raise DatoInvalido('Elige boleta o factura')
    numero = _texto(datos.get('comprobante_numero'), 20)
    if numero and not re.fullmatch(r'[0-9A-Za-z-]{1,20}', numero):
        raise DatoInvalido('El número de comprobante solo puede tener letras, números y guiones')
    return {'comprobanteTipo': tipo, 'comprobanteNumero': numero}


def _persona(datos, campo):
    return nombre_propio(_texto(datos.get(campo), 60))


def extra_ingreso(producto, datos, cantidad):
    tipo = producto.get('tipoMerch')
    extra = {'proveedor': '', 'taller': '', 'costoUnitario': None, 'costoTotal': None, 'costoMateriales': None,
             'loteCodigo': '', 'comprobanteTipo': '', 'comprobanteNumero': ''}
    if tipo in ('paneton', 'promocional'):
        extra['proveedor'] = _persona(datos, 'proveedor')
        if tipo == 'promocional' and not extra['proveedor']:
            raise DatoInvalido('Falta el proveedor')
        extra['costoUnitario'] = dinero(datos.get('costo_unitario'), 'el costo unitario')
        extra['costoTotal'] = round(extra['costoUnitario'] * cantidad, 2)
        extra.update(_comprobante(datos))
    if tipo == 'hogar':
        extra['taller'] = _texto(datos.get('taller'), 40)
        extra['costoMateriales'] = dinero(datos.get('costo_materiales'), 'el costo de materiales', obligatorio=False, mayor_que_cero=False)
    if tipo == 'paneton' or (tipo == 'hogar' and producto.get('subcategoria') == 'alimentos'):
        codigo = _texto(datos.get('lote_codigo'), 20)
        if codigo and not re.fullmatch(r'[0-9A-Za-z./-]{1,20}', codigo):
            raise DatoInvalido('El lote solo puede tener letras, números y . / -')
        extra['loteCodigo'] = codigo
    return extra


def precio_sugerido(producto, cantidad):
    desde, rebajado = producto.get('descuentoDesde'), producto.get('precioDescuento')
    if desde and rebajado is not None and cantidad >= desde:
        return float(rebajado)
    return float(producto.get('precio') or 0)


def extra_salida(producto, datos, cantidad):
    precio = datos.get('precio_unitario')
    if precio in (None, ''):
        precio = precio_sugerido(producto, cantidad)
    precio = dinero(precio, 'el precio unitario', mayor_que_cero=False)
    medio = datos.get('medio_pago') or ''
    if medio and medio not in MEDIOS_PAGO:
        raise DatoInvalido('Elige el medio de pago de la lista')
    return {
        'comprador': _persona(datos, 'comprador'),
        'precioUnitario': precio,
        'total': round(precio * cantidad, 2),
        'medioPago': medio,
        **_comprobante(datos),
    }
