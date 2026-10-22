import { escapar, iniciales, fechaDe, fechaLarga, textoFecha, tiempoRelativo, meses, textoCambio } from './Comunes.js';

// color del punto segun lo que se hizo
const colores = { ingreso: 'verde', salida: 'naranja', ajuste: 'morado', donador: 'azul', usuario: 'azul', rol: 'gris', estado: 'rojo' };

// cuantos registros se muestran en el panel (los mas recientes)
const limite = 60;

// todo lo que hizo una cuenta, del mas nuevo al mas antiguo:
// sus movimientos (historial) + el resto de acciones (actividad), sin duplicar nada en la bd
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
function nombreDia(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);

  const dias = Math.round((hoy - dia) / (24 * 60 * 60 * 1000));
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return dia.getFullYear() === hoy.getFullYear() ? `${dia.getDate()} ${meses[dia.getMonth()]}` : fechaLarga(dia);
}

const roles = ['Usuario', 'Administrador'];

// rol y activar/desactivar: lo usa el admin con otras cuentas (en celular la tabla no los muestra)
function ControlesCuenta(cuenta) {
  return `
    <div class="panel-actividad-controles">
      <label>
        <span>Rol</span>
        <select class="selector-rol" data-id="${cuenta.id}">
          ${roles.map(r => `<option ${r === cuenta.rol ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </label>
      <button class="btn-mini ${cuenta.activo ? 'btn-mini-rojo' : ''}" data-accion="activar-usuario" data-id="${cuenta.id}">
        ${cuenta.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
      </button>
    </div>`;
}

// panel que sale por la derecha; esPropio: "Mi actividad" del que inicio sesion
// administrar: el admin viendo a otra persona (muestra rol y activar/desactivar)
export function PanelActividad(cuenta, items, esPropio, administrar = false) {
  const ingresos = items.filter(i => i.accion === 'ingreso').length;
  const salidas = items.filter(i => i.accion === 'salida').length;
  const visibles = items.slice(0, limite);

  let diaAnterior = '';
  const lista = visibles.map(i => {
    const dia = nombreDia(i.fecha);
    const titulo = dia !== diaAnterior ? `<li class="actividad-dia">${dia}</li>` : '';
    diaAnterior = dia;
    const hora = textoFecha(i.fecha).split(' ')[2];

    return `
      ${titulo}
      <li class="actividad-item">
        <span class="actividad-punto ${colores[i.accion] || 'gris'}"></span>
        <div>
          <b>${escapar(i.texto)}</b>
          ${i.detalle ? `<small>${escapar(i.detalle)}</small>` : ''}
        </div>
        <span class="actividad-hora">${hora}</span>
      </li>
    `;
  }).join('');

  return `
    <div class="fondo-modal fondo-panel">
      <aside class="panel-actividad" aria-label="Actividad de ${escapar(cuenta.nombre)}">
        <div class="panel-actividad-cabecera">
          <span class="avatar ${cuenta.rol === 'Administrador' ? '' : 'avatar-verde'}">${iniciales(cuenta.nombre)}</span>
          <div>
            <div class="modal-titulo">${esPropio ? 'Mi actividad' : escapar(cuenta.nombre)}</div>
            <div class="modal-sub">@${escapar(cuenta.usuario)} · ${cuenta.rol}${cuenta.activo ? '' : ' · desactivado'}</div>
          </div>
          <button type="button" class="btn-cerrar" data-accion="cerrar-modal" aria-label="Cerrar">×</button>
        </div>

        ${administrar ? ControlesCuenta(cuenta) : ''}

        <div class="panel-actividad-resumen">
          <div><b>${ingresos}</b><span>ingresos</span></div>
          <div><b>${salidas}</b><span>salidas</span></div>
          <div><b>${items.length - ingresos - salidas}</b><span>otras acciones</span></div>
          <div><b>${cuenta.ultimoAcceso ? tiempoRelativo(cuenta.ultimoAcceso) : '—'}</b><span>último acceso</span></div>
        </div>

        <ul class="panel-actividad-lista">
          ${lista || '<li class="vacio">Todavía no hay actividad</li>'}
          ${items.length > limite ? `<li class="actividad-mas">Mostrando las ${limite} más recientes de ${items.length}</li>` : ''}
        </ul>
      </aside>
    </div>
  `;
}
