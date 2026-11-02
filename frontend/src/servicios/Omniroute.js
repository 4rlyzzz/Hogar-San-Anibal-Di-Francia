export const procesarTextoConOmniroute = async (textoDictado) => {
  try {
    const res = await fetch('/omniroute/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'inventario-fallback',
        messages: [
          {
            role: 'system',
            content: 'Convierte el dictado en una lista JSON de objetos con las llaves: "producto", "cantidad" y "unidad". Devuelve ÚNICAMENTE el arreglo JSON sin formato Markdown.'
          },
          {
            role: 'user',
            content: textoDictado
          }
        ],
        temperature: 0.1,
      }),
    });

    const data = await res.json();
    let contenido = data.choices[0].message.content.trim();
    
    if (contenido.startsWith('```')) {
      contenido = contenido.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(contenido);
  } catch (err) {
    console.error('Error enviando dictado a OmniRoute:', err);
    throw err;
  }
};