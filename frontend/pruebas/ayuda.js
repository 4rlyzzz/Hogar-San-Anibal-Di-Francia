// ayudas para las pruebas

// fecha aaaa-mm-dd de dentro de n dias (hora local, igual que diasHasta)
export function enDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const dos = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

// Date de hace n dias
export function haceDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function lote(id, quedan, vence = null, ingreso = haceDias(1)) {
  return { id, ingreso, vence, cantidad: quedan, quedan, origen: '' };
}

export function producto(nombre, { cantidad, minimo = 5, unidad = 'kg', lotes = [], ...extra } = {}) {
  const total = cantidad ?? lotes.reduce((s, l) => s + l.quedan, 0);
  return { nombre, cantidad: total, minimo, unidad, lotes, ...extra };
}
