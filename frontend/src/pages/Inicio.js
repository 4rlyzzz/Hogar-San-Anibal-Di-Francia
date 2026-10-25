import { Encabezado, TituloSeccion, TituloOrden, nombreCategoria, colorVencimiento, Recuadro, escapar, textoCambio, diasParaVencer, porVencer, bajoMinimo, fechaDe, meses } from '../components/Comunes.js';
import { AlertaSobrestock, itemSobrestock } from '../components/Alerta.js';
import { calcularAlertas, ordenarAlertas, coloresPrioridad, PastillasProblemas } from '../components/Alertas.js';
import { iconoAlimentos, iconoSalud, iconoReloj, iconoCaja } from '../assets/icons.js';


// ---------- recuadros de arriba ----------
function Recuadros(estado) {
  const todos = [...estado.alimentos, ...estado.salud];
  const vencen = todos.filter(porVencer).length;
  const bajos = todos.filter(bajoMinimo).length;

  return `
    <div class="panel-recuadros">
      ${Recuadro('verde', iconoAlimentos, estado.alimentos.length, 'Alimentos', `${estado.alimentos.filter(porVencer).length} por vencer`)}
      ${Recuadro('azul', iconoSalud, estado.salud.length, 'Salud e higiene', `${estado.salud.filter(bajoMinimo).length} bajo mínimo`)}
      ${Recuadro('naranja', iconoReloj, vencen, 'Por vencer / vencidos', '≤ 15 días')}
      ${Recuadro('rojo', iconoCaja, bajos, 'Bajo stock mínimo', `de ${todos.length}`)}
    </div>
  `;
}

// ---------- grafico de ingresos y salidas ----------
const diasSemana = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// cuantos tramos se pueden ver
const cuantosTramos = { Día: 60, Semana: 26, Mes: 12 };

// ancho minimo de cada columna (px)
const anchoColumna = { movimientos: 58, stock: 84 };

// tramos de tiempo del grafico hasta hoy, del mas antiguo al mas nuevo
function tramos(periodo) {
  const cuantos = cuantosTramos[periodo];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const lista = [];

  const masDias = (fecha, n) => {
    const nueva = new Date(fecha);
    nueva.setDate(nueva.getDate() + n);
    return nueva;
  };

  if (periodo === 'Día') {
    for (let i = cuantos - 1; i >= 0; i--) {
      const inicio = masDias(hoy, -i);
      lista.push({ inicio, fin: masDias(inicio, 1), nombre: `${diasSemana[inicio.getDay()]} ${inicio.getDate()}` });
    }
  } else if (periodo === 'Semana') {
    for (let i = cuantos - 1; i >= 0; i--) {
      const fin = masDias(hoy, 1 - i * 7);
      const inicio = masDias(fin, -7);
      lista.push({ inicio, fin, nombre: `${inicio.getDate()} ${meses[inicio.getMonth()]}` });
    }
  } else {
    for (let i = cuantos - 1; i >= 0; i--) {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 1);
      lista.push({ inicio, fin, nombre: meses[inicio.getMonth()] });
    }
  }
  return lista;
}

// redondea el tope del eje
function topeEje(maximo) {
  const paso = Math.max(1, maximo / 4);
  const base = 10 ** Math.floor(Math.log10(paso));
  const redondo = [1, 2, 5, 10].find(n => n * base >= paso) * base;
  return redondo * 4;
}

// botones del grafico: campo es lo que cambian en estado.grafico
function Selector(campo, opciones, actual, clase = '') {
  return `
    <div class="filtros ${clase}">
      ${opciones.map(o => `
        <button class="${o === actual ? 'activo' : ''}" data-accion="grafico" data-campo="${campo}" data-valor="${o}">${o}</button>
      `).join('')}
    </div>`;
}

// eje fijo y grafico con scroll
// alFinal: empieza a la derecha
function Lienzo({ tope, columnas, ancho, contenido, nombres, alFinal = false }) {
  const pasos = [0, 1, 2, 3, 4];

  return `
    <div class="grafico-marco">
      <div class="grafico-eje">
        ${pasos.map(n => `<span style="bottom: ${n * 25}%">${tope / 4 * n}</span>`).join('')}
      </div>

      <div class="grafico-scroll" ${alFinal ? 'data-al-final' : ''}>
        <div class="grafico-lienzo" style="min-width: ${columnas * ancho}px">
          <div class="grafico">
            ${pasos.map(n => `<div class="grafico-linea" style="bottom: ${n * 25}%"></div>`).join('')}
            ${contenido}
          </div>
          <div class="grafico-nombres">${nombres}</div>
        </div>
      </div>
    </div>
  `;
}

// un recuadro con dos pestañas: movimientos (lineas) y stock (barras)
function Grafico(estado) {
  const { vista, periodo, categoria } = estado.grafico;
  const esStock = vista === 'Stock';

  return `
    <div class="panel">
      <div class="grafico-cabecera">
        ${Selector('vista', ['Movimientos', 'Stock'], vista, 'pestanas-grafico')}
        ${esStock
          ? Selector('categoria', ['Alimentos', 'Salud'], categoria)
          : Selector('periodo', ['Día', 'Semana', 'Mes'], periodo)}
      </div>
      ${esStock ? GraficoStock(estado, categoria) : GraficoMovimientos(estado, periodo)}
    </div>
  `;
}

// barras de stock, del mas bajo al mas alto
function GraficoStock(estado, categoria) {
  const lista = [...(categoria === 'Salud' ? estado.salud : estado.alimentos)]
    .sort((a, b) => a.cantidad / a.minimo - b.cantidad / b.minimo);
  const color = categoria === 'Salud' ? 'barra-azul' : 'barra-verde';

  const tope = topeEje(Math.max(...lista.map(i => Math.max(i.cantidad, i.minimo))));
  const alto = n => Math.min(100, n / tope * 100);

  const contenido = `
    <div class="grafico-columnas">
      ${lista.map((item, i) => `
        <div class="grafico-columna con-barras" tabindex="0">
          <div class="barra ${bajoMinimo(item) ? 'barra-baja' : color}" style="height: ${alto(item.cantidad)}%"></div>
          <div class="barra barra-minimo" style="height: ${alto(item.minimo)}%"></div>
          <div class="grafico-tooltip ${i >= lista.length / 2 ? 'a-la-izquierda' : ''}">
            <b>${escapar(item.nombre)}</b>
            <span>Stock: ${item.cantidad} ${escapar(item.unidad)}</span>
            <span>Mínimo: ${item.minimo} ${escapar(item.unidad)}</span>
            ${bajoMinimo(item) ? '<span class="tooltip-alerta">● Bajo el mínimo</span>' : ''}
          </div>
        </div>
      `).join('')}
    </div>`;

  return `
    <div class="leyenda leyenda-barras">
      <span><i class="${color}"></i>Stock actual</span>
      <span><i class="barra-minimo"></i>Stock mínimo</span>
      <span><i class="barra-baja"></i>Bajo el mínimo</span>
      <small>${lista.length} productos · del más cerca del mínimo al más lejos</small>
    </div>

    ${Lienzo({
      tope,
      columnas: lista.length,
      ancho: anchoColumna.stock,
      contenido,
      nombres: lista.map(item => `<span title="${escapar(item.nombre)}">${escapar(item.nombre)}</span>`).join(''),
    })}
  `;
}

function GraficoMovimientos(estado, periodo) {
  const fechas = estado.historial.map(f => ({ fecha: fechaDe(f.fecha), movimiento: f.movimiento }));

  // cuantos ingresos y salidas se registraron en cada tramo
  const datos = tramos(periodo).map(t => {
    const dentro = fechas.filter(f => f.fecha >= t.inicio && f.fecha < t.fin);
    return {
      nombre: t.nombre,
      ingresos: dentro.filter(f => f.movimiento === 'Ingreso').length,
      salidas: dentro.filter(f => f.movimiento === 'Salida').length,
    };
  });

  const tope = topeEje(Math.max(...datos.map(d => Math.max(d.ingresos, d.salidas))));

  // svg de 0 a 100 en ambos ejes
  const x = i => (i + 0.5) / datos.length * 100;
  const y = n => 100 - n / tope * 100;
  const linea = campo => datos.map((d, i) => `${i ? 'L' : 'M'}${x(i)} ${y(d[campo])}`).join(' ');
  const area = campo => `${linea(campo)} L${x(datos.length - 1)} 100 L${x(0)} 100 Z`;

  const desde = tramos(periodo)[0].inicio;
  const hoy = new Date();
  const rango = `${desde.getDate()} ${meses[desde.getMonth()]} – ${hoy.getDate()} ${meses[hoy.getMonth()]}`;

  const contenido = `
        <svg class="grafico-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="relleno-ingreso" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#3fb98f" stop-opacity="0.3"/>
              <stop offset="1" stop-color="#3fb98f" stop-opacity="0.02"/>
            </linearGradient>
            <linearGradient id="relleno-salida" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#e07b28" stop-opacity="0.22"/>
              <stop offset="1" stop-color="#e07b28" stop-opacity="0.02"/>
            </linearGradient>
          </defs>
          <path d="${area('salidas')}" fill="url(#relleno-salida)"/>
          <path d="${area('ingresos')}" fill="url(#relleno-ingreso)"/>
          <path d="${linea('salidas')}" class="trazo-salida"/>
          <path d="${linea('ingresos')}" class="trazo-ingreso"/>
        </svg>

        <div class="grafico-columnas">
          ${datos.map((d, i) => `
            <div class="grafico-columna" tabindex="0">
              <span class="grafico-punto salida" style="bottom: ${100 - y(d.salidas)}%"></span>
              <span class="grafico-punto ingreso" style="bottom: ${100 - y(d.ingresos)}%"></span>
              <div class="grafico-tooltip ${i >= datos.length / 2 ? 'a-la-izquierda' : ''}">
                <b>${d.nombre}</b>
                <span class="ingreso"><i></i>Ingresos: ${d.ingresos}</span>
                <span class="salida"><i></i>Salidas: ${d.salidas}</span>
              </div>
            </div>
          `).join('')}
        </div>`;

  return `
    <div class="leyenda">
      <span class="ingreso"><i></i><b>Ingresos</b><small>${rango}</small></span>
      <span class="salida"><i></i><b>Salidas</b><small>${rango}</small></span>
    </div>

    ${Lienzo({
      tope,
      columnas: datos.length,
      ancho: anchoColumna.movimientos,
      contenido,
      nombres: datos.map(d => `<span>${d.nombre}</span>`).join(''),
      alFinal: true,
    })}
  `;
}

// ---------- alerta principal: sobrestock ----------
function PanelSobrestock(estado) {
  const item = itemSobrestock(estado);
  if (item) return AlertaSobrestock(item, true);

  // sin riesgo: lo proximo en vencer
  const proximos = [
    ...estado.alimentos.map(item => ({ item, categoria: 'Alimentos' })),
    ...estado.salud.map(item => ({ item, categoria: 'Salud' })),
  ]
    .filter(p => (diasParaVencer(p.item) ?? -1) >= 0)
    .sort((a, b) => diasParaVencer(a.item) - diasParaVencer(b.item))
    .slice(0, 5);

  return `
    <div class="panel panel-sin-alerta">
      ${TituloSeccion('!', 'naranja', 'Riesgo de sobrestock', '')}
      <p class="sin-riesgo">✓ Ningún producto en riesgo de desperdicio</p>

      <span class="proximos-titulo">Lo próximo en vencer · usar primero</span>
      <ul class="proximos">
        ${proximos.map(({ item, categoria }) => {
          const dias = diasParaVencer(item);
          return `
            <li>
              <button class="proximo fila-boton" data-accion="ver-producto" data-categoria="${escapar(categoria)}" data-id="${escapar(item.id)}">
                <span>
                  <b>${escapar(item.nombre)}</b>
                  <small>${escapar(nombreCategoria(categoria))} · ${item.cantidad} ${escapar(item.unidad)}</small>
                </span>
                <span class="etiqueta ${colorVencimiento(item)}">${dias === 0 ? 'Hoy' : dias === 1 ? '1 día' : `${dias} días`}</span>
              </button>
            </li>`;
        }).join('')}
      </ul>
      ${proximos.length === 0 ? '<div class="vacio">Ningún producto con fecha de vencimiento</div>' : ''}
    </div>
  `;
}

// ---------- movimientos recientes ----------
function MovimientosRecientes(estado) {
  const ultimos = estado.historial.slice(0, 6);
  const verTodo = `<button class="link" data-accion="seccion" data-seccion="Historial">Ver historial →</button>`;

  return `
    <div class="panel">
      ${TituloSeccion('HI', 'gris', 'Movimientos recientes', '', verTodo)}

      <ul class="linea-tiempo">
        ${ultimos.map(f => {
          const [dia, mes, hora] = f.fecha.split(' ');
          const verbo = { Ingreso: 'un ingreso', Salida: 'una salida', Ajuste: 'un ajuste' }[f.movimiento];
          return `
            <li class="${{ Ingreso: 'ingreso', Salida: 'salida', Ajuste: 'ajuste' }[f.movimiento]}">
              <span class="linea-hora">${hora}<small>${dia} ${mes}</small></span>
              <span class="linea-punto"></span>
              <div class="linea-texto">
                <b>${escapar(f.responsable)}</b> registró ${verbo} de
                <span class="mono">${escapar(textoCambio(f))}</span>
                <small>${escapar(f.insumo)}${f.donador ? ` · donado por ${escapar(f.donador)}` : ''}</small>
              </div>
            </li>
          `;
        }).join('')}
      </ul>

      ${ultimos.length === 0 ? '<div class="vacio">Sin movimientos</div>' : ''}
    </div>
  `;
}

// ---------- otras alertas: vencimiento y stock ----------
function OtrasAlertas(estado) {
  // el sobrestock ya tiene su recuadro arriba
  const filas = ordenarAlertas(calcularAlertas(estado, false), estado.alertasOrden);
  const o = estado.alertasOrden;

  return `
    <div class="tabla">
      <div class="tabla-header">
        ${TituloSeccion('AV', 'rojo', 'Otras alertas', `${filas.length} de alimentos, salud e higiene`)}
      </div>

      <div class="alerta-fila fila-titulos">
        <span>${TituloOrden('PRODUCTO', 'producto', o, 'alertasOrden')}</span>
        <span>${TituloOrden('CATEGORÍA', 'categoria', o, 'alertasOrden')}</span>
        <span>${TituloOrden('ALERTA', 'alerta', o, 'alertasOrden')}</span>
        <span>${TituloOrden('PRIORIDAD', 'prioridad', o, 'alertasOrden')}</span>
      </div>

      ${filas.map(f => `
        <button class="alerta-fila fila-boton" data-accion="ver-producto" data-categoria="${escapar(f.categoria)}" data-id="${escapar(f.item.id)}">
          <span class="fila-insumo">${escapar(f.item.nombre)}</span>
          <span class="alerta-fila-categoria"><span class="pastilla ${f.categoria === 'Salud' ? 'azul' : 'verde'}">${escapar(nombreCategoria(f.categoria))}</span></span>
          <span class="alerta-fila-tipo">${PastillasProblemas(f.problemas)}</span>
          <span class="alerta-fila-prioridad"><span class="pastilla ${coloresPrioridad[f.prioridad]}">${f.prioridad}</span></span>
        </button>
      `).join('')}

      ${filas.length === 0 ? '<div class="vacio">Todo en orden, no hay alertas</div>' : ''}
    </div>
  `;
}

export function paginaInicio(estado) {
  return `
    ${Encabezado('Inicio')}
    ${Recuadros(estado)}

    <div class="panel-medio">
      ${Grafico(estado)}
      ${PanelSobrestock(estado)}
    </div>

    <div class="panel-bajo">
      ${MovimientosRecientes(estado)}
      ${OtrasAlertas(estado)}
    </div>
  `;
}
