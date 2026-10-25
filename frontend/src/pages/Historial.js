import { Encabezado, nombreCategoria, nombresCategoria, escapar, fechaDe, textoCambio, textoStock, textoDetalle } from '../components/Comunes.js';
import { iconoDescargar } from '../assets/icons.js';
import { BotonFiltros, PanelFiltros, CampoSelect, CampoFecha, Chips } from '../components/Filtros.js';

// filtros del historial (tambien para el Excel)
export function filtrarHistorial(estado) {
  const f = estado.historialFiltros;
  // incluye los nombres de productos unidos
  const producto = [...estado.alimentos, ...estado.salud].find(p => p.nombre === f.producto);
  const nombresProducto = [f.producto, ...(producto?.unidos || [])];
  const texto = estado.busqueda.toLowerCase();
  const desde = f.desde ? new Date(f.desde + 'T00:00:00') : null;
  const hasta = f.hasta ? new Date(f.hasta + 'T23:59:59') : null;

  return estado.historial.filter(fila => {
    if (f.movimiento !== 'Todos' && fila.movimiento !== f.movimiento) return false;
    if (f.categoria !== 'Todos' && fila.categoria !== f.categoria) return false;
    if (f.responsable !== 'Todos' && fila.responsable !== f.responsable) return false;
    if (f.producto !== 'Todos' && !nombresProducto.includes(fila.insumo)) return false;
    if (f.para !== 'Todos' && fila.para !== f.para) return false;
    if (f.donador !== 'Todos' && fila.donador !== f.donador) return false;
    if (f.actividad !== 'Todos' && fila.actividad !== f.actividad) return false;

    if (desde || hasta) {
      const fecha = fechaDe(fila.fecha);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
    }

    return (fila.insumo + ' ' + fila.responsable + ' ' + fila.donador + ' ' + fila.para).toLowerCase().includes(texto);
  });
}

// valores distintos que aparecen en el historial, ordenados
function opcionesDe(filas, campo) {
  return [...new Set(filas.map(f => f[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const clases = { Ingreso: 'ingreso', Salida: 'salida', Ajuste: 'ajuste' };
const plurales = { Ingreso: 'Ingresos', Salida: 'Salidas', Ajuste: 'Ajustes' };

// opciones para CampoSelect
function opcionesCon(todos, valores) {
  return { Todos: todos, ...Object.fromEntries(valores.map(v => [v, v])) };
}

// '2026-10-01' -> '01/10/2026'
function fechaCorta(iso) {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

// pastillas de lo que esta filtrado
function chipsHistorial(f) {
  const chips = [];
  if (f.movimiento !== 'Todos') chips.push({ campo: 'movimiento', texto: plurales[f.movimiento] });
  if (f.categoria !== 'Todos') chips.push({ campo: 'categoria', texto: f.categoria });
  if (f.responsable !== 'Todos') chips.push({ campo: 'responsable', texto: f.responsable });
  if (f.producto !== 'Todos') chips.push({ campo: 'producto', texto: f.producto });
  if (f.para !== 'Todos') chips.push({ campo: 'para', texto: 'Para ' + f.para });
  if (f.donador !== 'Todos') chips.push({ campo: 'donador', texto: 'Donó ' + f.donador });
  if (f.actividad !== 'Todos') chips.push({ campo: 'actividad', texto: f.actividad });
  if (f.desde) chips.push({ campo: 'desde', texto: 'Desde ' + fechaCorta(f.desde) });
  if (f.hasta) chips.push({ campo: 'hasta', texto: 'Hasta ' + fechaCorta(f.hasta) });
  return chips;
}

export function paginaHistorial(estado) {
  const f = estado.historialFiltros;
  const filas = filtrarHistorial(estado);
  const ingresos = filas.filter(x => x.movimiento === 'Ingreso').length;

  // los productos se acotan a la categoria elegida
  const paraProductos = f.categoria === 'Todos' ? estado.historial : estado.historial.filter(x => x.categoria === f.categoria);
  const chips = chipsHistorial(f);
  // "para quien" solo en Salud
  const ninos = f.categoria === 'Alimentos' ? [] : opcionesDe(estado.historial, 'para');
  const abierto = estado.filtrosAbiertos === 'historialFiltros';

  return `
    ${Encabezado(`Historial <span class="contador">${estado.historial.length}</span>`)}

    <div class="con-filtros">
    <div class="tabla">
      <div class="tabla-header barra-tabla">
        <span class="barra-tabla-resumen">
          <b>${filas.length}</b> movimientos<span class="solo-desktop"> · ${ingresos} ingresos · ${filas.length - ingresos} salidas</span>
        </span>
        ${BotonFiltros('historialFiltros', chips.length, abierto)}
        <button class="btn-descargar" data-accion="descargar-historial" ${filas.length ? '' : 'disabled'} title="Descargar lo filtrado en Excel">
          ${iconoDescargar}<span class="solo-desktop">Descargar</span> Excel
        </button>
        ${Chips('historialFiltros', chips)}
      </div>

      <div class="fila fila-titulos">
        <span>FECHA</span><span>INSUMO</span><span>CATEGORÍA</span><span>MOVIMIENTO</span><span>CANTIDAD</span><span>STOCK</span><span>DETALLE</span><span>RESPONSABLE</span>
      </div>

      ${filas.map(fila => `
        <button class="fila fila-boton ${clases[fila.movimiento]}" data-accion="ver-movimiento" data-indice="${estado.historial.indexOf(fila)}">
          <span class="fila-fecha">${escapar(fila.fecha)}</span>
          <span class="fila-insumo">
            ${escapar(fila.insumo)}
          </span>
          <span class="fila-categoria"><span class="pastilla ${fila.categoria === 'Salud' ? 'azul' : 'verde'}">${escapar(nombreCategoria(fila.categoria))}</span></span>
          <span class="fila-movimiento">● ${fila.movimiento}</span>
          <span class="fila-cantidad">${escapar(textoCambio(fila))}</span>
          <span class="fila-saldo" title="Stock antes → después de este movimiento">${textoStock(fila)}</span>
          <span class="fila-detalle ${fila.inicial ? 'inicial' : ''}">${escapar(textoDetalle(fila))}</span>
          <span class="fila-responsable">${escapar(fila.responsable)}</span>
        </button>
      `).join('')}

      ${filas.length === 0 ? '<div class="vacio">Ningún movimiento coincide con los filtros</div>' : ''}
    </div>

    ${abierto ? PanelFiltros('historialFiltros', `
      ${CampoSelect('historialFiltros', 'movimiento', 'Movimiento', { Todos: 'Todos', Ingreso: 'Solo ingresos', Salida: 'Solo salidas', Ajuste: 'Solo ajustes' }, f.movimiento)}
      ${CampoSelect('historialFiltros', 'categoria', 'Categoría', { Todos: 'Todas', ...nombresCategoria }, f.categoria)}
      ${CampoSelect('historialFiltros', 'responsable', 'Responsable', opcionesCon('Todos', opcionesDe(estado.historial, 'responsable')), f.responsable)}
      ${CampoSelect('historialFiltros', 'producto', 'Producto', opcionesCon('Todos', opcionesDe(paraProductos, 'insumo')), f.producto)}
      ${ninos.length ? CampoSelect('historialFiltros', 'para', 'Para (niño/a)', opcionesCon('Todos', ninos), f.para) : ''}
      ${CampoSelect('historialFiltros', 'donador', 'Donador', opcionesCon('Todos', opcionesDe(estado.historial, 'donador')), f.donador)}
      ${CampoSelect('historialFiltros', 'actividad', 'Actividad de donación', opcionesCon('Todas', opcionesDe(estado.historial, 'actividad')), f.actividad)}
      <div class="campos-dos">
        ${CampoFecha('historialFiltros', 'desde', 'Desde', f.desde)}
        ${CampoFecha('historialFiltros', 'hasta', 'Hasta', f.hasta)}
      </div>
    `, filas.length) : ''}
    </div>
  `;
}
