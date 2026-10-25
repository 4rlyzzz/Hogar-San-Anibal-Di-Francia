import { escapar, iniciales, fechaDe, fechaLarga } from './Comunes.js';
import { actividadesDe } from '../pages/Donadores.js';

// historial de un donador: que dono, cuando y para que actividad
// panel del donador
export function PanelDonador(d, donaciones) {
  const actividades = actividadesDe(donaciones);
  const ultima = donaciones[0];
  const telefono = d.telefono.replace(/\s/g, '');

  let anioAnterior = '';
  const lista = donaciones.map(x => {
    const anio = String(fechaDe(x.fecha).getFullYear());
    const titulo = anio !== anioAnterior ? `<li class="actividad-dia">${anio}</li>` : '';
    anioAnterior = anio;

    return `
      ${titulo}
      <li class="actividad-item">
        <span class="actividad-punto verde"></span>
        <div>
          <b>${escapar(x.insumo)} · +${x.cantidad} ${escapar(x.unidad)}</b>
          <small>${x.actividad ? escapar(x.actividad) : 'Sin actividad'} · recibió ${escapar(x.responsable)}</small>
        </div>
        <span class="actividad-hora">${x.fecha.split(' ').slice(0, 2).join(' ')}</span>
      </li>
    `;
  }).join('');

  return `
    <div class="fondo-modal fondo-panel">
      <aside class="panel-actividad" aria-label="Donaciones de ${escapar(d.nombre)}">
        <div class="panel-actividad-cabecera">
          <span class="avatar avatar-verde">${iniciales(d.nombre)}</span>
          <div>
            <div class="modal-titulo">${escapar(d.nombre)}</div>
            <div class="modal-sub">
              <a href="tel:${escapar(telefono)}" class="link-telefono">${escapar(d.telefono)}</a>
              ${d.creadoPor ? ` · agregado por ${escapar(d.creadoPor)}` : ''}
            </div>
          </div>
          <button type="button" class="btn-cerrar" data-accion="cerrar-modal" aria-label="Cerrar">×</button>
        </div>

        <div class="panel-actividad-resumen tres">
          <div><b>${donaciones.length}</b><span>donaciones</span></div>
          <div><b>${actividades.length}</b><span>actividades</span></div>
          <div><b>${ultima ? fechaLarga(fechaDe(ultima.fecha)) : '—'}</b><span>última donación</span></div>
        </div>

        ${actividades.length ? `
          <div class="donador-apoyo">
            <span>APOYÓ EN</span>
            <div>
              ${actividades.map(([a, n]) => `<span class="pastilla-actividad">${escapar(a)} <b>×${n}</b></span>`).join('')}
            </div>
          </div>` : ''}

        <ul class="panel-actividad-lista">
          ${lista || '<li class="vacio">Todavía no registra donaciones</li>'}
        </ul>

        ${donaciones.length ? `
          <div class="panel-donador-pie">
            <button class="link" data-accion="historial-donador" data-id="${escapar(d.id)}">Ver sus donaciones en el historial →</button>
          </div>` : ''}
      </aside>
    </div>
  `;
}
