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
   - Ejemplo: "dos cajas de paracetamol 100 mg" -> producto "Paracetamol 100 mg", cantidad 2, unidad "cajas".
   - Ejemplo: "tres latas de leche gloria de 400 gramos" -> producto "Leche Gloria 400 g", cantidad 3, unidad "latas".
   - Ejemplo: "entrada de 5 sacos de arroz de 50 kg" -> producto "Arroz 50 kg", cantidad 5, unidad "sacos" (NUNCA cantidad 50).
   - Si se dice un envase ("sacos", "cajas", "latas") y además un peso o volumen, la cantidad es la de envases.
5. METADATOS COMPLEMENTARIOS:
   - cantidad: cuántos envases o unidades entran o salen, número mayor a 0. Si no se comprende la cifra, usa 1.
   - unidad: el envase o la medida de esa cantidad ("cajas", "frascos", "kg"), no la dosis.
   - vence: "YYYY-MM-DD" si se menciona fecha explícita. Si es dudosa o incoherente, pon null.
   - correcciones: si el usuario corrige una cifra o fecha, usa SIEMPRE la última opción.

Responde SOLO el JSON plano, sin markdown:
[{"tipo":"ingreso|salida","producto":"nombre con su dosis o tamaño","cantidad":1,"unidad":"envase/medida","vence":"YYYY-MM-DD|null"}]"""


def _texto(valor, maximo):
    return ' '.join(valor.split())[:maximo] if isinstance(valor, str) else ''


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
        items.append({
            'tipo': d.get('tipo') if d.get('tipo') in ('ingreso', 'salida') else None,
            'producto': producto,
            # la pantalla revisa la cantidad (0, negativa o texto queda como "falta la cantidad")
            'cantidad': cantidad if isinstance(cantidad, (int, float)) and not isinstance(cantidad, bool) else None,
            'unidad': _texto(d.get('unidad'), 30),
            'vence': vence if isinstance(vence, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', vence) else None,
        })
    return items


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
            r = requests.post(f'{settings.OMNIROUTE_URL}/v1/chat/completions', headers=cabeceras,
                              timeout=TIMEOUT, json=cuerpo)
            r.raise_for_status()
            contenido = r.json()['choices'][0]['message']['content']
        except (requests.exceptions.RequestException, ValueError, KeyError, IndexError, TypeError):
            logger.exception('OmniRoute no respondio bien')
            return Response({'error': 'El dictado con IA no está disponible'}, status=503)

        return Response({'items': limpiar_items(contenido)}, status=200)


class SaludView(APIView):
    """Para el chequeo de salud de Railway: responde si Django esta arriba."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    def get(self, request):
        return Response({'ok': True})
