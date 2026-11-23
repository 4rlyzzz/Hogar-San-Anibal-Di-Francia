// listas largas por paginas: el historial, los donadores o el inventario no se dibujan enteros

// cuantos se ven por pagina (el primero es el de siempre)
export const tamanosTabla = [25, 50, 100];
export const tamanosTarjetas = [15, 30, 50];

// los tamaños que tienen sentido: hasta el primero que ya muestra todo
// (con 18: 15 y 30; el 50 se veria igual que el 30)
export function tamanosUtiles(opciones, total) {
  return opciones.filter((n, i) => i === 0 || opciones[i - 1] < total);
}

// la pagina pedida de la lista; si ya no existe (se filtro y quedan menos) se ve la ultima
export function paginar(lista, pagina, porPagina) {
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(Math.max(1, pagina), paginas);
  const desde = (actual - 1) * porPagina;
  return {
    visibles: lista.slice(desde, desde + porPagina),
    total,
    pagina: actual,
    paginas,
    // para "16–30 de 44"
    desde: total ? desde + 1 : 0,
    hasta: Math.min(desde + porPagina, total),
  };
}
