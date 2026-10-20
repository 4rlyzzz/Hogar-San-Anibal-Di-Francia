import { Encabezado, TituloSeccion, escapar, diasParaVencer, porVencer, fechaDe, meses } from '../components/Comunes.js';
import { AlertaSobrestock, itemSobrestock } from '../components/Alerta.js';
import { iconoAlimentos, iconoSalud, iconoReloj, iconoCaja } from '../assets/icons.js';

const prioridades = { Alta: 'rojo', Media: 'naranja', Baja: 'azul' };

function bajoMinimo(item) {
  return item.cantidad < item.minimo;
}

// ---------- recuadros de arriba ----------
function Recuadro(color, icono, numero, titulo, detalle) {
  return `
    <div class="recuadro">
      <div class="recuadro-cabecera">
        <div class="recuadro-icono ${color}">${icono}</div>
        <span class="recuadro-titulo">${titulo}</span>
      </div>
      <div class="recuadro-fila">
        <b class="recuadro-numero">${numero}</b>
        <span class="recuadro-unidad">${numero === 1 ? 'producto' : 'productos'}</span>
        <span class="recuadro-detalle texto-${color}">${detalle}</span>
      </div>
    </div>
  `;
}

function Recuadros(estado) {
  const todos = [...estado.alimentos, ...estado.salud];
  const vencen = todos.filter(porVencer).length;
  const bajos = todos.filter(bajoMinimo).length;

  return `
    <div class="panel-recuadros">
      ${Recuadro('verde', iconoAlimentos, estado.alimentos.length, 'Alimentos', `${estado.alimentos.filter(porVencer).length} por vencer`)}
      ${Recuadro('azul', iconoSalud, estado.salud.length, 'Salud', `${estado.salud.filter(bajoMinimo).length} bajo mínimo`)}
      ${Recuadro('naranja', iconoReloj, vencen, 'Por vencer / vencidos', '≤ 15 días')}
      ${Recuadro('rojo', iconoCaja, bajos, 'Bajo stock mínimo', `de ${todos.length}`)}
    </div>
  `;
}

// ---------- grafico de lineas: ingresos vs salidas en el tiempo ----------
const diasSemana = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// cuantos tramos hacia atras se pueden ver; lo que no entra se desliza
const cuantosTramos = { Día: 60, Semana: 26, Mes: 12 };

// ancho minimo de cada columna en px; si no entran todas aparece el scroll
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

// redondea el tope del eje a un numero facil de leer (4, 8, 20, 40...)
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

// el eje y queda fijo a la izquierda y el resto se desliza si no entra
// alFinal: empieza mostrando lo de la derecha (lo mas reciente)
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

// barras: todos los productos, del mas cerca del minimo al mas lejos
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

  // el svg va de 0 a 100 en ambos ejes; cada punto cae al centro de su columna
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

  return `
    <div class="panel panel-sin-alerta">
      ${TituloSeccion('!', 'naranja', 'Riesgo de sobrestock', 'alerta prioritaria')}
      <div class="vacio">Ningún producto en riesgo de desperdicio por sobrestock</div>
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
          const esIngreso = f.movimiento === 'Ingreso';
          return `
            <li class="${esIngreso ? 'ingreso' : 'salida'}">
              <span class="linea-hora">${hora}<small>${dia} ${mes}</small></span>
              <span class="linea-punto"></span>
              <div class="linea-texto">
                <b>${escapar(f.responsable)}</b> registró ${esIngreso ? 'un ingreso' : 'una salida'} de
                <span class="mono">${esIngreso ? '+' : '−'}${f.cantidad} ${escapar(f.unidad)}</span>
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
function alertasDe(lista, categoria) {
  const filas = [];

  lista.forEach(item => {
    const dias = diasParaVencer(item);
    if (dias !== null && dias < 0) {
      filas.push({ item, categoria, tipo: 'Vencido', detalle: `Venció hace ${-dias} días`, prioridad: 'Alta' });
    } else if (dias !== null && dias <= 3) {
      filas.push({ item, categoria, tipo: 'Por vencer', detalle: `Vence en ${dias} días`, prioridad: 'Alta' });
    } else if (dias !== null && dias <= 15) {
      filas.push({ item, categoria, tipo: 'Por vencer', detalle: `Vence en ${dias} días`, prioridad: 'Media' });
    }

    if (bajoMinimo(item)) {
      filas.push({ item, categoria, tipo: 'Stock bajo', detalle: `${item.cantidad} de ${item.minimo} ${item.unidad} mín.`, prioridad: 'Alta' });
    } else if (item.cantidad <= item.minimo * 1.2) {
      filas.push({ item, categoria, tipo: 'Revisar consumo', detalle: `${item.cantidad} de ${item.minimo} ${item.unidad} mín.`, prioridad: 'Baja' });
    }
  });

  return filas;
}

function OtrasAlertas(estado) {
  const orden = Object.keys(prioridades);
  const filas = [...alertasDe(estado.alimentos, 'Alimentos'), ...alertasDe(estado.salud, 'Salud')]
    .sort((a, b) => orden.indexOf(a.prioridad) - orden.indexOf(b.prioridad));

  return `
    <div class="tabla">
      <div class="tabla-header">
        ${TituloSeccion('AV', 'rojo', 'Otras alertas', `${filas.length} de alimentos y salud`)}
      </div>

      <div class="alerta-fila fila-titulos">
        <span>PRODUCTO</span><span>CATEGORÍA</span><span>ALERTA</span><span>PRIORIDAD</span>
      </div>

      ${filas.map(f => `
        <div class="alerta-fila">
          <span class="fila-insumo">${escapar(f.item.nombre)}</span>
          <span class="alerta-fila-categoria"><span class="pastilla ${f.categoria === 'Salud' ? 'azul' : 'verde'}">${f.categoria}</span></span>
          <span class="alerta-fila-tipo">${f.tipo}<small>${escapar(f.detalle)}</small></span>
          <span class="alerta-fila-prioridad"><span class="pastilla ${prioridades[f.prioridad]}">${f.prioridad}</span></span>
        </div>
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
