"""Dictado con IA: el navegador manda el texto dictado y Django se lo pasa a OmniRoute.

Asi la clave de OmniRoute queda en el servidor, solo quien inicio sesion puede usarlo
y lo que responde la IA se limpia antes de llegar a la pantalla.
Si OmniRoute no esta configurado o falla, responde 503 y la pantalla usa el reconocimiento local.
"""
import json
import logging
import re

import requests
from django.conf import settings
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

TIMEOUT = 20
MAX_TEXTO = 600
MAX_ITEMS = 20

INSTRUCCIONES = """Extrae productos de inventario desde voz en JSON.

REGLAS DE PRECISIÓN Y ANTI-ALUCINACIÓN:
1. NO INVENTES PRODUCTOS: Si una palabra es ruido, balbuceo o incomprensible, IGNÓRALA en lugar de adivinar un nombre de producto.
2. PRESERVA LO VÁLIDO: Si un fragmento es incomprensible pero otro sí tiene sentido, extrae ÚNICAMENTE el producto válido.
3. OPERACIÓN ('tipo'):
   - "salida": si indica sacar, usar, retirar, llevarse o dar de baja.
   - "ingreso": por defecto si es agregar, comprar, donar o neutro.
4. NOMBRE COMPLETO DEL PRODUCTO:
   - La dosis, concentración o tamaño que acompaña al nombre ES PARTE DEL PRODUCTO, nunca la cantidad ni la unidad:
     "100 mg", "500 mg", "120 mg/5 ml", "0.9 %", "x 100 tabletas", "1 L", "400 g".
   - Escribe la medida abreviada con cifras: "cien miligramos" -> "100 mg", "medio litro" -> "500 ml".
   - La presentación ("en cajas de 10 unidades", "saco de 50 kg", "blíster de 10") solo describe el producto: no es la cantidad.
5. CANTIDAD Y UNIDAD (NO HAGAS CÁLCULOS NI CONVERSIONES):
   - cantidad: el número que se dijo para cuántos entran o salen, TAL CUAL. Nunca lo multipliques ni lo dividas. Mayor a 0.
   - Si no se dijo cuántos (solo el nombre o el tamaño del envase), cantidad null. NUNCA uses el tamaño del envase como cantidad.
   - unidad: la palabra dicha justo después de ese número ("cajas", "unidades", "kg", "sacos"). Si no se dijo ninguna, null.
   - Ejemplo: "dos cajas de paracetamol 100 mg" -> producto "Paracetamol 100 mg", cantidad 2, unidad "cajas".
   - Ejemplo: "salida de 60 paracetamol 100 mg en cajas de 10 unidades" -> producto "Paracetamol 100 mg", cantidad 60, unidad null.
   - Ejemplo: "salida de paracetamol 100 mg en cajas de 20 unidades" -> producto "Paracetamol 100 mg", cantidad null, unidad null.
   - Ejemplo: "salida de 30 unidades de ibuprofeno 400 mg" -> producto "Ibuprofeno 400 mg", cantidad 30, unidad "unidades".
   - Ejemplo: "entrada de 5 sacos de arroz de 50 kg" -> producto "Arroz 50 kg", cantidad 5, unidad "sacos" (NUNCA cantidad 50).
   - Ejemplo: "tres latas de leche gloria de 400 gramos" -> producto "Leche Gloria 400 g", cantidad 3, unidad "latas".
6. OTROS DATOS:
   - vence: "YYYY-MM-DD" si se menciona fecha explícita. Si es dudosa o incoherente, pon null.
   - correcciones: si el usuario corrige una cifra o fecha, usa SIEMPRE la última opción.
7. VENTAS Y COMPRAS (panetones, polos, tazas y otros artículos que el hogar vende):
   - "vender", "vendí", "venta", "vendido" es "salida"; "compramos", "nos llegó del proveedor" es "ingreso".
   - comprador: a quién se le vendió ("vendido a Juan Pérez", "le vendí a la señora Rosa", "venta de 3 panetones a María López"). Si no se dijo, null.
   - proveedor: a quién se le compró ("comprado a Distribuidora Lima", "del proveedor Textiles Sur", "compramos 20 polos a Textiles Sur"). Si no se dijo, null.
   - Si el comprador, el proveedor o el medio de pago se dijo UNA vez para varios productos ("vendimos 4 panetones y 2 tazas a Rosa Quispe con Yape"), ponlo en TODOS esos productos.
   - precio: el precio de UNA unidad en soles, solo si se dijo ("a 25 soles cada uno" -> 25). Si dijeron el total, null.
   - medio_pago: "efectivo", "yape-plin" (Yape o Plin) o "transferencia", solo si se dijo. Si no, null.
   - La talla y el color de una prenda SON PARTE DEL PRODUCTO: "dos polos talla M azules" -> producto "Polo talla M azul", cantidad 2.
   - La talla se escribe con sus letras aunque se diga por su nombre: "talla eme" -> "talla M", "talla ese" -> "talla S", "talla ele" -> "talla L", "talla equis ele" -> "talla XL", "talla doble equis ele" -> "talla XXL".

Responde SOLO el JSON plano, sin markdown:
[{"tipo":"ingreso|salida","producto":"nombre con su dosis o tamaño","cantidad":"número|null","unidad":"palabra tras el número|null","vence":"YYYY-MM-DD|null","comprador":"nombre|null","proveedor":"nombre|null","precio":"número|null","medio_pago":"efectivo|yape-plin|transferencia|null"}]"""

MEDIOS_PAGO = ('efectivo', 'yape-plin', 'transferencia')


def _texto(valor, maximo):
    return ' '.join(valor.split())[:maximo] if isinstance(valor, str) else ''


def _precio_valido(precio):
    return isinstance(precio, (int, float)) and not isinstance(precio, bool) and 0 < precio <= 100000


def limpiar_items(contenido):
    """Lo que devolvio el modelo -> lista de items con solo los campos esperados."""
    contenido = str(contenido or '')
    # algunos modelos (Qwen, DeepSeek) escriben su razonamiento entre <think> antes del JSON
    contenido = re.sub(r'<think>.*?</think>', '', contenido, flags=re.S).strip()
    contenido = re.sub(r'^```(?:json)?\s*|\s*```$', '', contenido)
    try:
        datos = json.loads(contenido)
    except ValueError:
        return []
    if isinstance(datos, dict):
        datos = [datos]
    if not isinstance(datos, list):
        return []

    items = []
    for d in datos[:MAX_ITEMS]:
        if not isinstance(d, dict):
            continue
        producto = _texto(d.get('producto'), 60)
        if not producto:
            continue
        cantidad = d.get('cantidad')
        vence = d.get('vence')
        precio = d.get('precio')
        items.append({
            'tipo': d.get('tipo') if d.get('tipo') in ('ingreso', 'salida') else None,
            'producto': producto,
            # la pantalla revisa la cantidad (0, negativa o texto queda como "falta la cantidad")
            'cantidad': cantidad if isinstance(cantidad, (int, float)) and not isinstance(cantidad, bool) else None,
            'unidad': _texto(d.get('unidad'), 30),
            'vence': vence if isinstance(vence, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', vence) else None,
            **{k: v for k, v in {
                'comprador': _texto(d.get('comprador'), 60),
                'proveedor': _texto(d.get('proveedor'), 60),
                'precio': precio if _precio_valido(precio) else None,
                'medio_pago': d.get('medio_pago') if d.get('medio_pago') in MEDIOS_PAGO else None,
            }.items() if v},
        })
    return items


def url_chat(base):
    """La direccion a la que se manda el dictado.

    OmniRoute y Groq reciben la base y se les agrega /v1/chat/completions
    (http://localhost:20128, https://api.groq.com/openai). Gemini usa otra ruta, asi que su
    direccion se pone completa y se usa tal cual:
    https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
    """
    base = base.rstrip('/')
    return base if base.endswith('/chat/completions') else f'{base}/v1/chat/completions'


class DictadoView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'dictado'

    def post(self, request):
        if not settings.OMNIROUTE_URL:
            return Response({'error': 'El dictado con IA no está configurado'}, status=503)

        texto = _texto(request.data.get('texto'), MAX_TEXTO)
        if not texto:
            return Response({'items': []}, status=200)

        cabeceras = {'Content-Type': 'application/json'}
        if settings.OMNIROUTE_API_KEY:
            cabeceras['Authorization'] = f'Bearer {settings.OMNIROUTE_API_KEY}'
        try:
            cuerpo = {
                'model': settings.OMNIROUTE_MODEL,
                # los modelos que "piensan" (GPT OSS, Gemini 2.5) gastan parte de este limite
                # razonando antes de responder: con poco margen la respuesta llega vacia
                'max_tokens': settings.OMNIROUTE_MAX_TOKENS,
                'temperature': 0.0,
                'messages': [
                    {'role': 'system', 'content': INSTRUCCIONES},
                    {'role': 'user', 'content': texto},
                ],
            }
            if settings.OMNIROUTE_REASONING_EFFORT:
                cuerpo['reasoning_effort'] = settings.OMNIROUTE_REASONING_EFFORT
            r = requests.post(url_chat(settings.OMNIROUTE_URL), headers=cabeceras, timeout=TIMEOUT, json=cuerpo)
            r.raise_for_status()
            contenido = r.json()['choices'][0]['message']['content']
        except (requests.exceptions.RequestException, ValueError, KeyError, IndexError, TypeError):
            logger.exception('La IA del dictado no respondio bien (%s, modelo %s)', settings.OMNIROUTE_URL, settings.OMNIROUTE_MODEL)
            return Response({'error': 'El dictado con IA no está disponible'}, status=503)

        return Response({'items': limpiar_items(contenido)}, status=200)


class SaludView(APIView):
    """Para el chequeo de salud de Railway: responde si Django esta arriba."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        return Response({'ok': True})
