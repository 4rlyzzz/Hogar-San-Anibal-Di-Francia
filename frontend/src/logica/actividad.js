import { fechaDe, fechaLarga, meses, textoCambio } from './comunes.js';

// color del punto segun lo que se hizo
export const coloresActividad = { ingreso: 'verde', salida: 'naranja', ajuste: 'morado', donador: 'azul', usuario: 'azul', rol: 'gris', estado: 'rojo' };

// todo lo que hizo una cuenta, del mas nuevo al mas antiguo:
// movimientos del historial + otras acciones
export function actividadDe(estado, cuenta) {
  const movimientos = estado.historial
    .filter(f => f.responsable === cuenta.nombre)
    .map(f => ({
      fecha: fechaDe(f.fecha),
      accion: f.movimiento.toLowerCase(),
      texto: `${f.movimiento} · ${f.insumo}`,
      detalle: textoCambio(f) + (f.donador ? ' · donado por ' + f.donador : '') + (f.motivo ? ' · ' + f.motivo : ''),
    }));

  const otras = estado.actividad
    .filter(a => a.quienId === cuenta.id)
    .map(a => ({ fecha: a.fecha, accion: a.accion, texto: `${a.texto} · ${a.detalle}`, detalle: '' }));

  return [...movimientos, ...otras].sort((a, b) => b.fecha - a.fecha);
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
