"""Movimientos de stock hechos por el servidor.

El navegador solo dice que quiere hacer ("salen 8 de este producto"); aqui se lee el producto
como esta AHORA en CouchDB, se valida con ese dato y se guarda con su _rev. Si otra persona lo
cambio al mismo tiempo, CouchDB responde 409 y se vuelve a intentar sobre el dato nuevo.
Asi dos salidas a la vez nunca dejan el stock negativo ni se pisan.

Producto y movimiento son dos documentos (CouchDB no tiene transacciones): si el movimiento
no se puede guardar, se deshace el cambio del producto. Nunca queda stock sin su movimiento.

Los lotes se manejan igual que logica/lotes.js en el frontend.
"""
import copy
import itertools
import logging
import math
import re
import time
from datetime import date, datetime, timedelta, timezone

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import IsAdminRole
from .couchdb_service import (
    actualizar_con_reintento,
    create_document,
    delete_document,
    get_document_by_id,
)

logger = logging.getLogger(__name__)

# Peru no cambia de hora: siempre UTC-5 (para "vencido", la fecha que se muestra, etc.)
ZONA = timezone(timedelta(hours=-5))
MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
CANTIDAD_MAXIMA = 100000
INTENTOS = 20
CANALES = ('manual', 'codigo', 'voz')
_contador = itertools.count()


class Rechazo(Exception):
    """No se puede hacer con el stock de ahora. producto: el dato real, para que la pantalla se ponga al dia."""

    def __init__(self, mensaje, producto=None, status=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.producto = producto
        self.status = status


# ---------- fechas ----------

def _ahora():
    return datetime.now(timezone.utc)


def _hoy():
    return datetime.now(ZONA).date()


def _fecha_texto(momento):
    """'07 oct 09:05' en hora de Peru (asi se muestra en el historial)."""
    local = momento.astimezone(ZONA)
    return f"{local.day:02d} {MESES[local.month - 1]} {local.hour:02d}:{local.minute:02d}"


def _fecha_lote(ingreso):
    """ISO -> '19 oct' (de que lote salio)."""
    try:
        momento = datetime.fromisoformat(str(ingreso).replace('Z', '+00:00'))
    except ValueError:
        return ''
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    local = momento.astimezone(ZONA)
    return f"{local.day:02d} {MESES[local.month - 1]}"


# ---------- lotes (igual que logica/lotes.js) ----------

def _redondear(n):
    return round(n * 100) / 100


def _num(n):
    """2.0 -> '2', 2.5 -> '2.5' (para los mensajes)"""
    return f'{_redondear(n):g}'


def _vencido(lote):
    vence = lote.get('vence')
    if not vence:
        return False
    try:
        return date.fromisoformat(vence) < _hoy()
    except ValueError:
        return False


def _con_stock(producto):
    return [l for l in (producto.get('lotes') or []) if (l.get('quedan') or 0) > 0]


def cantidad_vencida(producto):
    return _redondear(sum(l['quedan'] for l in _con_stock(producto) if _vencido(l)))


def disponible(producto):
    return _redondear(float(producto.get('cantidad') or 0) - cantidad_vencida(producto))


def _orden_uso(lote):
    # primero lo que vence antes; sin fecha, por orden de llegada
    return (0, lote['vence'], str(lote.get('ingreso', ''))) if lote.get('vence') else (1, '', str(lote.get('ingreso', '')))


def _plan(producto, cantidad, con_vencidos=False):
    lotes = sorted((l for l in _con_stock(producto) if con_vencidos or not _vencido(l)), key=_orden_uso)
    plan, falta = [], cantidad
    for lote in lotes:
        if falta <= 0:
            break
        sale = _redondear(min(lote['quedan'], falta))
        plan.append((lote, sale))
        falta = _redondear(falta - sale)
    return plan


def _descontar(plan):
    """Saca del lote y devuelve lo que se anota en el movimiento."""
    usados = []
    for lote, cantidad in plan:
        lote['quedan'] = _redondear(lote['quedan'] - cantidad)
        usados.append({'id': lote['id'], 'ingreso': _fecha_lote(lote.get('ingreso')), 'cantidad': cantidad})
    return usados


def _nuevo_lote(producto, cantidad, vence=None, origen=''):
    lote = {
        'id': int(time.time() * 1000) * 100 + next(_contador) % 100,
        'ingreso': _ahora().isoformat(),
        'vence': vence,
        'cantidad': cantidad,
        'quedan': cantidad,
        'origen': origen,
    }
    producto['lotes'] = [*(producto.get('lotes') or []), lote]
    return lote


# ---------- lo que manda el navegador ----------

def _decimales(unidad):
    return 2 if unidad in ('kg', 'L') else 0


def _cantidad(valor, unidad, que='La cantidad', puede_ser_cero=False):
    try:
        n = float(valor)
    except (TypeError, ValueError):
        raise Rechazo(f'{que} tiene que ser un número')
    if not math.isfinite(n) or n < 0 or (n == 0 and not puede_ser_cero):
        raise Rechazo(f'{que} tiene que ser mayor que 0')
    if n > CANTIDAD_MAXIMA:
        raise Rechazo(f'{que} no puede ser mayor que {CANTIDAD_MAXIMA}')
    if round(n, _decimales(unidad)) != n:
        raise Rechazo(f'{que} en {unidad} tiene que ser un número entero' if not _decimales(unidad)
                      else f'{que} puede tener hasta 2 decimales')
    return n


def _texto(valor, maximo):
    return ' '.join(str(valor or '').split())[:maximo]


def _fecha_vence(valor):
    if valor in (None, ''):
        return None
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(valor)):
        raise Rechazo('La fecha de vencimiento no es válida')
    try:
        fecha = date.fromisoformat(valor)
    except ValueError:
        raise Rechazo('La fecha de vencimiento no es válida')
    if fecha < _hoy():
        raise Rechazo('Esa fecha ya pasó: si el producto está vencido, no lo registres')
    return valor


def _categoria(producto):
    return 'Salud' if str(producto.get('categoria', '')).lower() in ('salud', 'medicinas', 'higiene') else 'Alimentos'


# ---------- cada tipo de movimiento ----------
# reciben una copia del producto, la cambian y devuelven (movimiento, como deshacerlo)

def _ingreso(producto, datos):
    cantidad = _cantidad(datos.get('cantidad'), producto.get('unidad'))
    lote = _nuevo_lote(producto, cantidad, _fecha_vence(datos.get('vence')))
    producto['cantidad'] = _redondear(float(producto.get('cantidad') or 0) + cantidad)
    # el codigo escaneado queda en el producto (la proxima vez se reconoce)
    codigo = _texto(datos.get('codigo_barras'), 32)
    if codigo and re.fullmatch(r'[0-9A-Za-z-]{4,32}', codigo) and codigo not in (producto.get('codigosBarras') or []):
        producto['codigosBarras'] = [*(producto.get('codigosBarras') or []), codigo]
    donador = _texto(datos.get('donador'), 60)
    movimiento = {
        'movimiento': 'Ingreso', 'cantidad': cantidad,
        'donador': donador, 'actividad': _texto(datos.get('actividad'), 40) if donador else '',
        'loteId': lote['id'], 'vence': lote['vence'],
        **({'inicial': True} if datos.get('inicial') is True else {}),
    }
    return movimiento, {'delta': cantidad, 'usados': [], 'lote_nuevo': lote['id']}


def _salida(producto, datos):
    cantidad = _cantidad(datos.get('cantidad'), producto.get('unidad'))
    hay = disponible(producto)
    if cantidad > hay:
        vencida = cantidad_vencida(producto)
        raise Rechazo(
            f"Solo quedan {_num(hay)} {producto.get('unidad')} de \"{producto.get('nombre')}\""
            + (f' ({_num(vencida)} vencidos no cuentan)' if vencida else '')
            + ' (otra persona pudo registrar una salida al mismo tiempo)', producto)
    usados = _descontar(_plan(producto, cantidad))
    producto['cantidad'] = _redondear(float(producto.get('cantidad') or 0) - cantidad)
    para = [_texto(n, 30) for n in (datos.get('para') or []) if isinstance(n, str) and n.strip()][:20]
    movimiento = {'movimiento': 'Salida', 'cantidad': cantidad, 'para': para, 'lotes': usados}
    return movimiento, {'delta': -cantidad, 'usados': usados, 'lote_nuevo': None}


def _ajuste(producto, datos):
    contado = _cantidad(datos.get('contado'), producto.get('unidad'), 'La cantidad contada', puede_ser_cero=True)
    diferencia = _redondear(contado - float(producto.get('cantidad') or 0))
    if diferencia == 0:
        raise Rechazo(f"La cantidad contada ya coincide con el sistema ({_num(contado)} {producto.get('unidad')}): "
                      'otra persona pudo ajustarlo al mismo tiempo', producto)
    usados, lote_nuevo, extra = [], None, {}
    if diferencia < 0:
        usados = _descontar(_plan(producto, -diferencia, con_vencidos=True))
        extra['lotes'] = usados
    else:
        lote_nuevo = _nuevo_lote(producto, diferencia, origen='Sobrante del conteo')['id']
        extra['loteId'] = lote_nuevo
    producto['cantidad'] = contado
    corrige = datos.get('corrige')
    movimiento = {
        'movimiento': 'Ajuste', 'cantidad': abs(diferencia), 'diferencia': diferencia,
        'motivo': _texto(datos.get('motivo'), 60) or 'Sin identificar', 'nota': _texto(datos.get('nota'), 120),
        'corrige': str(corrige) if isinstance(corrige, (str, int)) and str(corrige) else None,
        **extra,
    }
    return movimiento, {'delta': diferencia, 'usados': usados, 'lote_nuevo': lote_nuevo}


def _baja(producto, datos):
    vencida = cantidad_vencida(producto)
    if vencida <= 0:
        raise Rechazo(f"\"{producto.get('nombre')}\" ya no tiene nada vencido (otra persona pudo darlo de baja)", producto)
    vencidos = [l for l in _con_stock(producto) if _vencido(l)]
    usados = _descontar([(l, l['quedan']) for l in vencidos])
    producto['cantidad'] = _redondear(float(producto.get('cantidad') or 0) - vencida)
    movimiento = {
        'movimiento': 'Salida', 'cantidad': vencida, 'lotes': usados,
        'motivo': 'Baja por vencimiento', 'nota': _texto(datos.get('nota'), 120),
    }
    return movimiento, {'delta': -vencida, 'usados': usados, 'lote_nuevo': None}


TIPOS = {'ingreso': _ingreso, 'salida': _salida, 'ajuste': _ajuste, 'baja': _baja}


def _deshacer(producto_id, deshacer):
    """Devuelve el producto a como estaba (si el movimiento no se pudo guardar)."""
    def cambiar(doc):
        lotes = [dict(l) for l in (doc.get('lotes') or []) if l.get('id') != deshacer['lote_nuevo']]
        for usado in deshacer['usados']:
            for lote in lotes:
                if lote.get('id') == usado['id']:
                    lote['quedan'] = _redondear(lote['quedan'] + usado['cantidad'])
        return {'lotes': lotes, 'cantidad': _redondear(float(doc.get('cantidad') or 0) - deshacer['delta'])}

    _, status = actualizar_con_reintento(producto_id, 'producto', cambiar, INTENTOS)
    if status != 200:
        logger.error('No se pudo deshacer el cambio de stock de %s: %s', producto_id, deshacer)


def _documento_movimiento(producto, movimiento, datos, request, momento):
    return {
        'tipo': 'movimiento',
        'producto_id': producto['_id'],
        'tipo_movimiento': movimiento['movimiento'].lower(),
        'insumo': producto.get('nombre', ''),
        'categoria': _categoria(producto),
        'unidad': producto.get('unidad', 'unidades'),
        'fecha': _fecha_texto(momento),
        'creado': momento.isoformat(),
        'canal': datos.get('canal') if datos.get('canal') in CANALES else 'manual',
        # quien lo hizo sale del token, no del navegador
        'usuario_id': request.user.id,
        'responsable': request.user.nombre,
        'donador': '', 'actividad': '', 'para': [],
        'observaciones': _texto(datos.get('observaciones'), 200),
        'saldo': producto['cantidad'],
        **movimiento,
    }


def _respuesta_rechazo(e):
    return Response({'error': e.mensaje, **({'producto': e.producto} if e.producto else {})}, status=e.status)


class RegistrarMovimientoView(APIView):
    """POST movimientos/ { tipo: ingreso|salida|ajuste|baja, producto_id, ... }
    Responde { producto, movimiento } como quedaron guardados."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        datos = request.data
        aplicar = TIPOS.get(datos.get('tipo'))
        if not aplicar:
            return Response({'error': 'Tipo de movimiento no válido'}, status=400)

        resultado = {}

        def cambiar(actual):
            if actual.get('unidoA'):
                raise Rechazo('Ese producto se unió a otro: recarga la página', status=409)
            producto = copy.deepcopy(actual)
            # con los datos de AHORA (si hubo conflicto, esto se vuelve a correr con lo nuevo)
            movimiento, deshacer = aplicar(producto, datos)
            resultado.update(movimiento=movimiento, deshacer=deshacer)
            return {'cantidad': producto['cantidad'], 'lotes': producto.get('lotes', []),
                    'codigosBarras': producto.get('codigosBarras', [])}

        try:
            producto, status = actualizar_con_reintento(str(datos.get('producto_id') or ''), 'producto', cambiar, INTENTOS)
        except Rechazo as e:
            return _respuesta_rechazo(e)
        if status == 404 or status == 400:
            return Response({'error': 'Ese producto ya no existe: recarga la página'}, status=404)
        if status == 409:
            return Response({'error': 'Varias personas están cambiando este producto a la vez: vuelve a intentarlo'}, status=409)
        if status != 200:
            return Response(producto, status=status)

        documento = _documento_movimiento(producto, resultado['movimiento'], datos, request, _ahora())
        guardado, status = create_document(documento)
        if status not in (200, 201):
            # sin movimiento no puede quedar el stock cambiado
            _deshacer(producto['_id'], resultado['deshacer'])
            return Response({'error': 'No se pudo guardar el movimiento: no se cambió el stock. Vuelve a intentarlo'}, status=502)

        return Response({'producto': producto, 'movimiento': {**documento, '_id': guardado.get('id'), '_rev': guardado.get('rev')}}, status=201)


def _misma_presentacion(a, b):
    igual = lambda x, y: str(x if x is not None else '').lower() == str(y if y is not None else '').lower()
    return all(igual(a.get(c), b.get(c)) for c in ('unidad', 'contenido', 'medida')) and _categoria(a) == _categoria(b)


class UnirProductosView(APIView):
    """POST productos/unir/ { origen_id, destino_id }: el stock del repetido (origen) pasa al que queda.
    Orden: se suma al destino, se anota el ajuste y se borra el origen con la version que se leyo.
    Si alguien movio el origen mientras tanto, el borrado falla y se deshace todo."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        origen_id = str(request.data.get('origen_id') or '')
        destino_id = str(request.data.get('destino_id') or '')
        if not origen_id or origen_id == destino_id:
            return Response({'error': 'Elige con qué producto se une'}, status=400)
        origen, status = get_document_by_id(origen_id, 'producto')
        if status != 200:
            return Response({'error': 'El producto repetido ya no existe: recarga la página'}, status=404)

        agregado = {}

        def sumar(destino):
            if not _misma_presentacion(origen, destino):
                raise Rechazo('Solo se pueden unir productos con la misma presentación')
            lotes = [copy.deepcopy(l) for l in _con_stock(origen)]
            agregado.update(lotes=[l['id'] for l in lotes], cantidad=float(origen.get('cantidad') or 0),
                            nombres=[origen.get('nombre'), *(origen.get('unidos') or [])])
            return {
                'cantidad': _redondear(float(destino.get('cantidad') or 0) + agregado['cantidad']),
                'lotes': [*(destino.get('lotes') or []), *lotes],
                'unidos': [*(destino.get('unidos') or []), *agregado['nombres']],
            }

        def restar(destino):
            return {
                'cantidad': _redondear(float(destino.get('cantidad') or 0) - agregado['cantidad']),
                'lotes': [l for l in (destino.get('lotes') or []) if l.get('id') not in agregado['lotes']],
                'unidos': [n for n in (destino.get('unidos') or []) if n not in agregado['nombres']],
            }

        try:
            destino, status = actualizar_con_reintento(destino_id, 'producto', sumar, INTENTOS)
        except Rechazo as e:
            return _respuesta_rechazo(e)
        if status != 200:
            return Response({'error': 'No se pudo actualizar el producto que queda: vuelve a intentarlo'}, status=409 if status == 409 else 502)

        movimiento = None
        if agregado['cantidad'] > 0:
            momento = _ahora()
            movimiento = _documento_movimiento(destino, {
                'movimiento': 'Ajuste', 'cantidad': agregado['cantidad'], 'diferencia': agregado['cantidad'],
                'motivo': 'Unión de productos', 'nota': f"Se unió \"{origen.get('nombre')}\"",
            }, {}, request, momento)
            guardado, status = create_document(movimiento)
            if status not in (200, 201):
                actualizar_con_reintento(destino_id, 'producto', restar, INTENTOS)
                return Response({'error': 'No se pudo anotar la unión: no se cambió nada. Vuelve a intentarlo'}, status=502)
            movimiento = {**movimiento, '_id': guardado.get('id'), '_rev': guardado.get('rev')}

        # con la version leida al principio: si alguien registro algo en el repetido, no se borra
        _, status = delete_document(origen_id, origen['_rev'], 'producto')
        if status not in (200, 201):
            if movimiento:
                delete_document(movimiento['_id'], movimiento['_rev'], 'movimiento')
            actualizar_con_reintento(destino_id, 'producto', restar, INTENTOS)
            return Response({'error': f"Mientras se unían, alguien registró un movimiento en \"{origen.get('nombre')}\". "
                                      'No se cambió nada: vuelve a intentarlo'}, status=409)

        return Response({'destino': destino, 'movimiento': movimiento}, status=200)
