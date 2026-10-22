import { Encabezado, SinResultados, escapar, meses, fechaDe } from '../components/Comunes.js';
import { BotonFiltros, PanelFiltros, CampoSelect, Chips } from '../components/Filtros.js';
import { iconoDescargar } from '../assets/icons.js';

// 'Agregado por Cocina · 20 oct'; los documentos viejos pueden no traer estos campos
function textoAgregado(d) {
  if (!d.creadoPor) return '';
  const fecha = d.creado ? ` · ${d.creado.getDate()} ${meses[d.creado.getMonth()]}` : '';
  return `Agregado por ${escapar(d.creadoPor)}${fecha}`;
}

// todas las donaciones de un donador (ingresos que lo nombran), de la mas nueva a la mas antigua
export function donacionesDe(estado, nombre) {
  return estado.historial.filter(f => f.movimiento === 'Ingreso' && f.donador === nombre);
}

// { 'Aniversario del hogar': 3, 'Navidad': 1 }, de la que mas apoyo a la que menos
export function actividadesDe(donaciones) {
  const cuenta = {};
  for (const d of donaciones) {
    if (d.actividad) cuenta[d.actividad] = (cuenta[d.actividad] || 0) + 1;
  }
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
}

function pasaFiltros(donacion, f) {
  if (f.actividad !== 'Todos' && donacion.actividad !== f.actividad) return false;
  if (f.anio !== 'Todos' && String(fechaDe(donacion.fecha).getFullYear()) !== f.anio) return false;
  return true;
}

// donadores con sus donaciones (ya filtradas por actividad y año)
// con filtros puestos solo quedan los que donaron en esa actividad o año: sirve para agradecer o volver a llamar
export function listaDonadores(estado) {
  const f = estado.donadoresFiltros;
  const hayFiltros = f.actividad !== 'Todos' || f.anio !== 'Todos';
  const texto = estado.busqueda.toLowerCase();

  return estado.donadores
    .filter(d => d.nombre.toLowerCase().includes(texto))
    .map(d => ({ donador: d, donaciones: donacionesDe(estado, d.nombre).filter(x => pasaFiltros(x, f)) }))
    .filter(x => !hayFiltros || x.donaciones.length > 0)
    .sort((a, b) => b.donaciones.length - a.donaciones.length || a.donador.nombre.localeCompare(b.donador.nombre));
}

function chipsDonadores(f) {
  const chips = [];
  if (f.actividad !== 'Todos') chips.push({ campo: 'actividad', texto: f.actividad });
  if (f.anio !== 'Todos') chips.push({ campo: 'anio', texto: 'Año ' + f.anio });
  return chips;
}

// pastillas de actividades: las 2 que mas apoyo y "+N" si hay mas
function PastillasActividades(actividades) {
  if (actividades.length === 0) return '<span class="uf-nada">—</span>';
  const visibles = actividades.slice(0, 2).map(([a, n]) => `<span class="pastilla-actividad">${escapar(a)}${n > 1 ? ` <b>×${n}</b>` : ''}</span>`);
  if (actividades.length > 2) visibles.push(`<span class="pastilla-actividad mas">+${actividades.length - 2}</span>`);
  return visibles.join('');
}

export function paginaDonadores(estado) {
  const f = estado.donadoresFiltros;
  const lista = listaDonadores(estado);
  const totalDonaciones = lista.reduce((suma, x) => suma + x.donaciones.length, 0);
  const chips = chipsDonadores(f);
  const abierto = estado.filtrosAbiertos === 'donadoresFiltros';

  // opciones de los filtros: las actividades y años que aparecen en las donaciones
  const todas = estado.historial.filter(x => x.movimiento === 'Ingreso' && x.donador);
  const actividades = [...new Set(todas.map(x => x.actividad).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const anios = [...new Set(todas.map(x => String(fechaDe(x.fecha).getFullYear())))].sort().reverse();

  return `
    ${Encabezado(`Donadores <span class="contador">${estado.donadores.length}</span>`)}

    <div class="con-filtros">
    <div class="tabla">
      <div class="tabla-header barra-tabla">
        <span class="barra-tabla-resumen">
          <b>${lista.length}</b> donadores · ${totalDonaciones} donaciones
        </span>
        ${BotonFiltros('donadoresFiltros', chips.length, abierto)}
        <button class="btn-descargar" data-accion="descargar-donadores" ${lista.length ? '' : 'disabled'} title="Descargar la lista en Excel">
          ${iconoDescargar}<span class="solo-desktop">Descargar</span> Excel
        </button>
        ${Chips('donadoresFiltros', chips)}
      </div>

      <div class="donador-fila fila-titulos">
        <span>NOMBRE</span><span>CONTACTO</span><span>ACTIVIDADES QUE APOYÓ</span><span>DONACIONES</span><span>ÚLTIMA</span>
      </div>

      ${lista.map(({ donador: d, donaciones }) => {
        const n = donaciones.length;
        const ultima = donaciones[0];
        return `
          <button class="donador-fila fila-boton" data-accion="ver-donador" data-id="${d.id}">
            <span class="donador-nombre">
              ${escapar(d.nombre)}
              ${d.creadoPor ? `<small>${textoAgregado(d)}</small>` : ''}
            </span>
            <span class="donador-telefono">${escapar(d.telefono)}</span>
            <span class="donador-actividades">${PastillasActividades(actividadesDe(donaciones))}</span>
            <span class="donador-donaciones">${n}<span class="solo-movil"> ${n === 1 ? 'donación' : 'donaciones'}</span></span>
            <span class="donador-ultima">${ultima ? ultima.fecha.split(' ').slice(0, 2).join(' ') : '—'}</span>
          </button>
        `;
      }).join('')}

      ${lista.length === 0 ? SinResultados(chips.length ? 'Ningún donador coincide con los filtros' : 'Todavía no hay donadores registrados') : ''}
    </div>

    ${abierto ? PanelFiltros('donadoresFiltros', `
      ${CampoSelect('donadoresFiltros', 'actividad', 'Actividad que apoyó', { Todos: 'Todas', ...Object.fromEntries(actividades.map(a => [a, a])) }, f.actividad)}
      ${CampoSelect('donadoresFiltros', 'anio', 'Año', { Todos: 'Todos', ...Object.fromEntries(anios.map(a => [a, a])) }, f.anio)}
    `, lista.length) : ''}
    </div>
  `;
}
