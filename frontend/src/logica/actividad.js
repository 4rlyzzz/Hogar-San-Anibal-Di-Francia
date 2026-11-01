import { momento, fechaLarga, meses, textoCambio, mismoId } from './comunes.js';

// color del punto segun lo que se hizo
export const coloresActividad = { ingreso: 'verde', salida: 'naranja', ajuste: 'morado', donador: 'azul', usuario: 'azul', rol: 'gris', estado: 'rojo', clave: 'gris' };

// el movimiento lo hizo esa cuenta: por su id; los movimientos viejos solo tienen el nombre
// o el usuario con el que entro (los primeros se guardaron como 'admin')
export function movimientoDe(fila, cuenta) {
  if (mismoId(fila.usuario_id, cuenta.id)) return true;
  return [cuenta.nombre, cuenta.usuario].filter(Boolean).some(n => n === fila.responsable || n === fila.usuario_id);
}

// lo agrego esa cuenta (donador o usuario): por su id, o por el nombre si no lo tiene
function creadoPor(doc, cuenta) {
  return doc.creadoPorId ? mismoId(doc.creadoPorId, cuenta.id) : doc.creadoPor === cuenta.nombre;
}

// todo lo que hizo una cuenta, del mas nuevo al mas antiguo
// sale de lo guardado en la base, asi se ve tambien despues de recargar:
// movimientos del historial, donadores y usuarios que agrego, y cambios de rol o estado que hizo
export function actividadDe(estado, cuenta) {
  const movimientos = estado.historial
    .filter(f => movimientoDe(f, cuenta) && f.fecha)
    .map(f => ({
      fecha: momento(f),
      accion: f.movimiento.toLowerCase(),
      texto: `${f.movimiento} · ${f.insumo}`,
      detalle: textoCambio(f) + (f.donador ? ' · donado por ' + f.donador : '') + (f.motivo ? ' · ' + f.motivo : ''),
    }));

  const donadores = estado.donadores
    .filter(d => d.creado && creadoPor(d, cuenta))
    .map(d => ({ fecha: d.creado, accion: 'donador', texto: `Agregó donador · ${d.nombre}`, detalle: '' }));

  const usuarios = estado.cuentas
    .filter(c => c.creado && c.creadoPorId && mismoId(c.creadoPorId, cuenta.id))
    .map(c => ({ fecha: c.creado, accion: 'usuario', texto: `Agregó usuario · ${c.nombre}`, detalle: '' }));

  const cambios = estado.cuentas.flatMap(c => (c.cambios || [])
    .filter(x => mismoId(x.quienId, cuenta.id))
    .map(x => ({
      fecha: new Date(x.fecha),
      accion: x.accion,
      texto: {
        rol: `Cambió el rol de ${c.nombre}`,
        clave: `Restableció la contraseña de ${c.nombre}`,
      }[x.accion] ?? `${x.valor ? 'Activó' : 'Desactivó'} a ${c.nombre}`,
      detalle: x.accion === 'rol' ? `Ahora es ${x.valor}` : '',
    })));

  return [...movimientos, ...donadores, ...usuarios, ...cambios]
    .filter(a => !Number.isNaN(a.fecha.getTime()))
    .sort((a, b) => b.fecha - a.fecha);
}

// 'Hoy', 'Ayer' o '15 oct' para agrupar la lista por dia
export function nombreDia(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);

  const dias = Math.round((hoy - dia) / (24 * 60 * 60 * 1000));
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return dia.getFullYear() === hoy.getFullYear() ? `${dia.getDate()} ${meses[dia.getMonth()]}` : fechaLarga(dia);
}
