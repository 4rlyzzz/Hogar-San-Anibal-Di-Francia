// validacion de los campos que escribe el usuario
// no usa el DOM, asi se puede reusar en React o en el backend
// cada regla devuelve { ok, valor } o { ok: false, error }

// ---------- limpieza ----------

// caracteres invisibles (saltos de linea, tabulaciones, etc.)
const control = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

export function limpiarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFC')
    .replace(control, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- texto ----------

// caracteres permitidos en cada tipo de texto (solo alfabeto latino)
const caracteres = {
  // productos
  producto: /^[\p{Script=Latin}0-9 .,\-/()%+&'°#]+$/u,
  // personas e instituciones
  nombre: /^[\p{Script=Latin}0-9 .,\-&'()]+$/u,
  // solo letras
  letras: /^[\p{Script=Latin} '-]+$/u,
  // notas y actividades
  libre: /^[\p{Script=Latin}0-9 .,;:\-/()%+&'°#¿?¡!]+$/u,
};

const textoCaracteres = {
  producto: 'letras, números, espacios y . , - / ( ) % + & \' ° #',
  nombre: 'letras, números, espacios y . , - & \' ( )',
  letras: 'letras y espacios',
  libre: 'letras, números, espacios y signos comunes',
};

// que: nombre del campo en el mensaje de error
export function texto({ min = 1, max, tipo = 'libre', que = 'este campo', opcional = false }) {
  return entrada => {
    const valor = limpiarTexto(entrada);
    if (!valor) return opcional ? { ok: true, valor: '' } : { ok: false, error: `Escribe ${que}.` };
    if (valor.length < min) return { ok: false, error: `${mayuscula(que)} debe tener al menos ${min} caracteres.` };
    if (valor.length > max) return { ok: false, error: `${mayuscula(que)} puede tener hasta ${max} caracteres.` };
    if (!caracteres[tipo].test(valor)) return { ok: false, error: `${mayuscula(que)} solo puede tener ${textoCaracteres[tipo]}.` };
    if (!/\p{Script=Latin}/u.test(valor) && tipo !== 'libre') return { ok: false, error: `${mayuscula(que)} debe tener al menos una letra.` };
    return { ok: true, valor };
  };
}

// ---------- numeros ----------

// solo digitos y una coma o punto
const formatoNumero = /^\d+([.,]\d+)?$/;

// minimoExcluido: tiene que ser mayor que min, no igual
export function numero({ min = 0, max, decimales = 0, que = 'la cantidad', minimoExcluido = false, opcional = false }) {
  return entrada => {
    // espacios en medio no se juntan: '12 5' no es 125
    const textoNumero = limpiarTexto(entrada);
    if (!textoNumero) return opcional ? { ok: true, valor: null } : { ok: false, error: `Escribe ${que}.` };
    if (!formatoNumero.test(textoNumero)) {
      return { ok: false, error: `${mayuscula(que)} tiene que ser un número${decimales ? '' : ' entero'}, sin letras ni signos.` };
    }

    const [, parteDecimal = ''] = textoNumero.split(/[.,]/);
    if (parteDecimal.length > decimales) {
      return {
        ok: false,
        error: decimales
          ? `${mayuscula(que)} puede tener hasta ${decimales} ${decimales === 1 ? 'decimal' : 'decimales'}.`
          : `${mayuscula(que)} tiene que ser un número entero.`,
      };
    }

    const valor = Number(textoNumero.replace(',', '.'));
    if (minimoExcluido ? valor <= min : valor < min) {
      return { ok: false, error: `${mayuscula(que)} tiene que ser mayor ${minimoExcluido ? 'que' : 'o igual a'} ${min}.` };
    }
    if (valor > max) return { ok: false, error: `${mayuscula(que)} no puede ser mayor que ${max}.` };
    return { ok: true, valor };
  };
}

// kg y L aceptan decimales, lo demas va entero
const decimalesPorUnidad = { kg: 2, L: 2 };

export function decimalesDe(unidad) {
  return decimalesPorUnidad[unidad] ?? 0;
}

// tope de cualquier cantidad
export const cantidadMaxima = 100000;

// cantidad segun la unidad del producto
export function cantidadDe(unidad, { que = 'la cantidad', puedeSerCero = false } = {}) {
  return numero({ min: 0, max: cantidadMaxima, decimales: decimalesDe(unidad), que, minimoExcluido: !puedeSerCero });
}

// ---------- fechas ----------

// fecha aaaa-mm-dd que exista
export function fechaValida(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
}

function isoDe(fecha) {
  const dos = n => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

// no puede haber pasado ni ser de mas de 10 años
export function vencimiento(entrada) {
  const valor = limpiarTexto(entrada);
  if (!fechaValida(valor)) return { ok: false, error: 'La fecha de vencimiento no es válida.' };

  const hoy = new Date();
  const limite = new Date(hoy.getFullYear() + 10, hoy.getMonth(), hoy.getDate());
  if (valor < isoDe(hoy)) return { ok: false, error: 'Esa fecha ya pasó: si el producto está vencido, no lo registres.' };
  if (valor > isoDe(limite)) return { ok: false, error: 'La fecha de vencimiento está demasiado lejos. Revísala.' };
  return { ok: true, valor };
}

// '' o una fecha valida
export function fechaFiltro(entrada) {
  const valor = limpiarTexto(entrada);
  if (valor === '' || fechaValida(valor)) return { ok: true, valor };
  return { ok: false, error: 'Fecha no válida.' };
}

// ---------- campos especiales ----------

// entre 6 y 15 digitos
export function telefono(entrada) {
  const valor = limpiarTexto(entrada);
  if (!valor) return { ok: false, error: 'Escribe el número de contacto.' };
  if (!/^\+?[\d\s\-()]+$/.test(valor)) return { ok: false, error: 'El número de contacto solo puede tener números, espacios y + - ( ).' };
  const digitos = valor.replace(/\D/g, '').length;
  if (digitos < 6 || digitos > 15) return { ok: false, error: 'El número de contacto debe tener entre 6 y 15 dígitos.' };
  return { ok: true, valor };
}

export function nombreUsuario(entrada) {
  const valor = limpiarTexto(entrada).toLowerCase();
  if (!valor) return { ok: false, error: 'Escribe el usuario.' };
  if (!/^[a-z0-9._-]{3,20}$/.test(valor)) {
    return { ok: false, error: 'El usuario debe tener de 3 a 20 caracteres: letras sin tildes, números y . _ -' };
  }
  return { ok: true, valor };
}

// la contraseña no se limpia
export function claveNueva(entrada) {
  const valor = String(entrada ?? '');
  if (valor.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  if (valor.length > 64) return { ok: false, error: 'La contraseña puede tener hasta 64 caracteres.' };
  if (!/\p{L}/u.test(valor) || !/\d/.test(valor)) return { ok: false, error: 'La contraseña debe tener letras y números.' };
  // sin la g para que no guarde la posicion
  if (new RegExp(control.source, 'u').test(valor)) return { ok: false, error: 'La contraseña tiene caracteres no permitidos.' };
  return { ok: true, valor };
}

// al entrar solo se revisa que no este vacia
export function claveLogin(entrada) {
  const valor = String(entrada ?? '');
  if (!valor) return { ok: false, error: 'Escribe tu contraseña.' };
  if (valor.length > 64) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  return { ok: true, valor };
}

// tiene que ser una de las opciones
export function opcion(opciones, que = 'una opción') {
  return entrada => (opciones.includes(entrada) ? { ok: true, valor: entrada } : { ok: false, error: `Elige ${que} de la lista.` });
}

// ---------- los campos de la app ----------

export const reglas = {
  nombreProducto: texto({ min: 2, max: 60, tipo: 'producto', que: 'el nombre del producto' }),
  envaseOtro: texto({ min: 2, max: 20, tipo: 'letras', que: 'el nombre del envase' }),
  contenido: numero({ min: 0, max: 10000, decimales: 2, que: 'cuánto trae cada uno', minimoExcluido: true }),
  nombreDonador: texto({ min: 2, max: 60, tipo: 'nombre', que: 'el nombre del donador' }),
  telefono,
  actividadOtra: texto({ min: 3, max: 40, tipo: 'libre', que: 'la actividad' }),
  nino: texto({ min: 2, max: 30, tipo: 'letras', que: 'el nombre del niño o niña' }),
  nota: texto({ max: 120, tipo: 'libre', que: 'el detalle', opcional: true }),
  notaObligatoria: texto({ min: 3, max: 120, tipo: 'libre', que: 'el detalle' }),
  nombreCuenta: texto({ min: 2, max: 40, tipo: 'nombre', que: 'el nombre' }),
  nombreUsuario,
  claveNueva,
  claveLogin,
  vencimiento,
  fechaFiltro,
};

// maxlength de los inputs
export const largos = {
  nombreProducto: 60,
  envaseOtro: 20,
  numero: 10,
  nombreDonador: 60,
  telefono: 20,
  actividadOtra: 40,
  nino: 30,
  nota: 120,
  nombreCuenta: 40,
  nombreUsuario: 20,
  clave: 64,
  busqueda: 60,
};

function mayuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
