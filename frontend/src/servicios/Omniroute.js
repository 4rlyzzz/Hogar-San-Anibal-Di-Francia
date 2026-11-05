import { preprocesarTextoVoz } from '../logica/dictado.js';

export const procesarTextoConOmniroute = async (textoDictado) => {
  const textoLimpio = preprocesarTextoVoz(textoDictado);
  const token = localStorage.getItem('access_token');

  try {
    const res = await fetch('/omniroute/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify({
        model: 'inventario-fallback',
        max_tokens: 280,
        temperature: 0.0, // 👈 Cero temperatura para reducir la creatividad/alucinación
        messages: [
          {
            role: 'system',
            content: `Extrae productos de inventario desde voz en JSON.

REGLAS DE PRECISIÓN Y ANTI-ALUCINACIÓN:
1. NO INVENTES PRODUCTOS: Si una palabra es ruido, balbuceo o incomprensible, IGNÓRALA en lugar de adivinar un nombre de producto.
2. PRESERVA LO VÁLIDO: Si un fragmento es incomprensible pero otro sí tiene sentido, extrae ÚNICAMENTE el producto válido.
3. OPERACIÓN ('tipo'):
   - "salida": si indica sacar, usar, retirar, llevarse o dar de baja.
   - "ingreso": por defecto si es agregar, comprar, donar o neutro.
4. METADATOS COMPLEMENTARIOS:
   - vence: "YYYY-MM-DD" si se menciona fecha explícita. Si es dudosa o incoherente, pon null.
   - correcciones: si el usuario corrige una cifra o fecha, usa SIEMPRE la última opción.
   - cantidad: número mayor a 0. Si no se comprende la cifra, usa 1.

Responde SOLO el JSON plano, sin markdown:
[{"tipo":"ingreso|salida","producto":"nombre","cantidad":1,"unidad":"medida/envase","vence":"YYYY-MM-DD|null"}]`
          },
          {
            role: 'user',
            content: textoLimpio
          }
        ]
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data.choices?.[0]?.message?.content) return [];

    let contenido = data.choices[0].message.content.trim();

    if (contenido.startsWith('```')) {
      contenido = contenido.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(contenido);
  } catch (err) {
    console.warn('Fallback al procesador local por cuota/error de OmniRoute:', err);
    return [];
  }
};