import { useEffect, useRef } from 'react';
import { useEstado } from '../estado.js';
import { IconoAlimentos, IconoSalud, IconoReloj, IconoCaja } from '../assets/iconos.jsx';
import { irA, verProducto, cambiar } from '../acciones.js';
import { nombreCategoria, colorVencimiento, textoCambio, diasParaVencer, porVencer, bajoMinimo, fechaDe, meses } from '../logica/comunes.js';
import { calcularAlertas, ordenarAlertas, coloresPrioridad, itemSobrestock } from '../logica/alertas.js';
import { Encabezado, TituloSeccion, TituloOrden, Recuadro, clasesMovimiento } from '../components/Comunes.jsx';
import { AlertaSobrestock } from '../components/AlertaSobrestock.jsx';
import { PastillasProblemas } from '../components/Paneles.jsx';

// ---------- recuadros de arriba ----------
function Recuadros({ estado }) {
  const todos = [...estado.alimentos, ...estado.salud];
  return (
    <div className="panel-recuadros">
      <Recuadro color="verde" Icono={IconoAlimentos} numero={estado.alimentos.length} titulo="Alimentos" detalle={`${estado.alimentos.filter(porVencer).length} por vencer`} />
      <Recuadro color="azul" Icono={IconoSalud} numero={estado.salud.length} titulo="Salud e higiene" detalle={`${estado.salud.filter(bajoMinimo).length} bajo mínimo`} />
      <Recuadro color="naranja" Icono={IconoReloj} numero={todos.filter(porVencer).length} titulo="Por vencer / vencidos" detalle="≤ 15 días" />
      <Recuadro color="rojo" Icono={IconoCaja} numero={todos.filter(bajoMinimo).length} titulo="Bajo stock mínimo" detalle={`de ${todos.length}`} />
    </div>
  );
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
  return [1, 2, 5, 10].find(n => n * base >= paso) * base * 4;
}

// botones del grafico: campo es lo que cambian en estado.grafico
function Selector({ campo, opciones, actual, clase = '' }) {
  return (
    <div className={`filtros ${clase}`}>
      {opciones.map(o => (
        <button key={o} className={o === actual ? 'activo' : ''} data-accion="grafico" onClick={() => cambiar(e => (e.grafico[campo] = o))}>{o}</button>
      ))}
    </div>
  );
}

// eje fijo y grafico con scroll
// alFinal: empieza a la derecha (lo mas reciente)
function Lienzo({ tope, columnas, ancho, nombres, alFinal = false, children }) {
  const scroll = useRef(null);
  useEffect(() => {
    if (alFinal) scroll.current.scrollLeft = scroll.current.scrollWidth;
  }, [alFinal, columnas]);

  const pasos = [0, 1, 2, 3, 4];
  return (
    <div className="grafico-marco">
      <div className="grafico-eje">
        {pasos.map(n => <span key={n} style={{ bottom: `${n * 25}%` }}>{tope / 4 * n}</span>)}
      </div>

      <div className="grafico-scroll" ref={scroll}>
        <div className="grafico-lienzo" style={{ minWidth: `${columnas * ancho}px` }}>
          <div className="grafico">
            {pasos.map(n => <div key={n} className="grafico-linea" style={{ bottom: `${n * 25}%` }} />)}
            {children}
          </div>
          <div className="grafico-nombres">{nombres.map((n, i) => <span key={i} title={n}>{n}</span>)}</div>
        </div>
      </div>
    </div>
  );
}

// barras de stock, del mas bajo al mas alto
function GraficoStock({ estado, categoria }) {
  const lista = [...(categoria === 'Salud' ? estado.salud : estado.alimentos)].sort((a, b) => a.cantidad / a.minimo - b.cantidad / b.minimo);
  const color = categoria === 'Salud' ? 'barra-azul' : 'barra-verde';
  const tope = topeEje(Math.max(...lista.map(i => Math.max(i.cantidad, i.minimo))));
  const alto = n => Math.min(100, n / tope * 100);

  return (
    <>
      <div className="leyenda leyenda-barras">
        <span><i className={color} />Stock actual</span>
        <span><i className="barra-minimo" />Stock mínimo</span>
        <span><i className="barra-baja" />Bajo el mínimo</span>
        <small>{lista.length} productos · del más cerca del mínimo al más lejos</small>
      </div>

      <Lienzo tope={tope} columnas={lista.length} ancho={anchoColumna.stock} nombres={lista.map(item => item.nombre)}>
        <div className="grafico-columnas">
          {lista.map((item, i) => (
            <div key={item.id} className="grafico-columna con-barras" tabIndex={0}>
              <div className={`barra ${bajoMinimo(item) ? 'barra-baja' : color}`} style={{ height: `${alto(item.cantidad)}%` }} />
              <div className="barra barra-minimo" style={{ height: `${alto(item.minimo)}%` }} />
              <div className={`grafico-tooltip ${i >= lista.length / 2 ? 'a-la-izquierda' : ''}`}>
                <b>{item.nombre}</b>
                <span>Stock: {item.cantidad} {item.unidad}</span>
                <span>Mínimo: {item.minimo} {item.unidad}</span>
                {bajoMinimo(item) && <span className="tooltip-alerta">● Bajo el mínimo</span>}
              </div>
            </div>
          ))}
        </div>
      </Lienzo>
    </>
  );
}

function GraficoMovimientos({ estado, periodo }) {
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

  return (
    <>
      <div className="leyenda">
        <span className="ingreso"><i /><b>Ingresos</b><small>{rango}</small></span>
        <span className="salida"><i /><b>Salidas</b><small>{rango}</small></span>
      </div>

      <Lienzo tope={tope} columnas={datos.length} ancho={anchoColumna.movimientos} nombres={datos.map(d => d.nombre)} alFinal>
        <svg className="grafico-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="relleno-ingreso" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3fb98f" stopOpacity="0.3" />
              <stop offset="1" stopColor="#3fb98f" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="relleno-salida" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e07b28" stopOpacity="0.22" />
              <stop offset="1" stopColor="#e07b28" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={area('salidas')} fill="url(#relleno-salida)" />
          <path d={area('ingresos')} fill="url(#relleno-ingreso)" />
          <path d={linea('salidas')} className="trazo-salida" />
          <path d={linea('ingresos')} className="trazo-ingreso" />
        </svg>

        <div className="grafico-columnas">
          {datos.map((d, i) => (
            <div key={i} className="grafico-columna" tabIndex={0}>
              <span className="grafico-punto salida" style={{ bottom: `${100 - y(d.salidas)}%` }} />
              <span className="grafico-punto ingreso" style={{ bottom: `${100 - y(d.ingresos)}%` }} />
              <div className={`grafico-tooltip ${i >= datos.length / 2 ? 'a-la-izquierda' : ''}`}>
                <b>{d.nombre}</b>
                <span className="ingreso"><i />Ingresos: {d.ingresos}</span>
                <span className="salida"><i />Salidas: {d.salidas}</span>
              </div>
            </div>
          ))}
        </div>
      </Lienzo>
    </>
  );
}

// un recuadro con dos pestañas: movimientos (lineas) y stock (barras)
function Grafico({ estado }) {
  const { vista, periodo, categoria } = estado.grafico;
  const esStock = vista === 'Stock';

  return (
    <div className="panel">
      <div className="grafico-cabecera">
        <Selector campo="vista" opciones={['Movimientos', 'Stock']} actual={vista} clase="pestanas-grafico" />
        {esStock
          ? <Selector campo="categoria" opciones={['Alimentos', 'Salud']} actual={categoria} />
          : <Selector campo="periodo" opciones={['Día', 'Semana', 'Mes']} actual={periodo} />}
      </div>
      {esStock ? <GraficoStock estado={estado} categoria={categoria} /> : <GraficoMovimientos estado={estado} periodo={periodo} />}
    </div>
  );
}

// ---------- sobrestock ----------
function PanelSobrestock({ estado }) {
  const item = itemSobrestock(estado);
  if (item) return <AlertaSobrestock item={item} />;

  // sin riesgo: lo proximo en vencer
  const proximos = [
    ...estado.alimentos.map(item => ({ item, categoria: 'Alimentos' })),
    ...estado.salud.map(item => ({ item, categoria: 'Salud' })),
  ]
    .filter(p => (diasParaVencer(p.item) ?? -1) >= 0)
    .sort((a, b) => diasParaVencer(a.item) - diasParaVencer(b.item))
    .slice(0, 5);

  return (
    <div className="panel panel-sin-alerta">
      <TituloSeccion codigo="!" color="naranja" titulo="Riesgo de sobrestock" detalle="" />
      <p className="sin-riesgo">✓ Ningún producto en riesgo de desperdicio</p>

      <span className="proximos-titulo">Lo próximo en vencer · usar primero</span>
      <ul className="proximos">
        {proximos.map(({ item, categoria }) => {
          const dias = diasParaVencer(item);
          return (
            <li key={categoria + item.id}>
              <button className="proximo fila-boton" data-accion="ver-producto" onClick={() => verProducto(categoria, item.id)}>
                <span>
                  <b>{item.nombre}</b>
                  <small>{nombreCategoria(categoria)} · {item.cantidad} {item.unidad}</small>
                </span>
                <span className={`etiqueta ${colorVencimiento(item)}`}>{dias === 0 ? 'Hoy' : dias === 1 ? '1 día' : `${dias} días`}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {proximos.length === 0 && <div className="vacio">Ningún producto con fecha de vencimiento</div>}
    </div>
  );
}

// ---------- movimientos recientes ----------
const verbos = { Ingreso: 'un ingreso', Salida: 'una salida', Ajuste: 'un ajuste' };

function MovimientosRecientes({ estado }) {
  const ultimos = estado.historial.slice(0, 6);

  return (
    <div className="panel">
      <TituloSeccion codigo="HI" color="gris" titulo="Movimientos recientes" detalle="">
        <button className="link" data-accion="seccion" data-seccion="Historial" onClick={() => irA('Historial')}>Ver historial →</button>
      </TituloSeccion>

      <ul className="linea-tiempo">
        {ultimos.map((f, i) => {
          const [dia, mes, hora] = f.fecha.split(' ');
          return (
            <li key={i} className={clasesMovimiento[f.movimiento]}>
              <span className="linea-hora">{hora}<small>{dia} {mes}</small></span>
              <span className="linea-punto" />
              <div className="linea-texto">
                <b>{f.responsable}</b> registró {verbos[f.movimiento]} de{' '}
                <span className="mono">{textoCambio(f)}</span>
                <small>{f.insumo}{f.donador ? ` · donado por ${f.donador}` : ''}</small>
              </div>
            </li>
          );
        })}
      </ul>

      {ultimos.length === 0 && <div className="vacio">Sin movimientos</div>}
    </div>
  );
}

// ---------- otras alertas: vencimiento y stock ----------
function OtrasAlertas({ estado }) {
  // el sobrestock ya tiene su recuadro arriba
  const filas = ordenarAlertas(calcularAlertas(estado, false), estado.alertasOrden);
  const o = estado.alertasOrden;

  return (
    <div className="tabla">
      <div className="tabla-header">
        <TituloSeccion codigo="AV" color="rojo" titulo="Otras alertas" detalle={`${filas.length} de alimentos, salud e higiene`} />
      </div>

      <div className="alerta-fila fila-titulos">
        <span><TituloOrden texto="PRODUCTO" orden="producto" filtros={o} grupo="alertasOrden" /></span>
        <span><TituloOrden texto="CATEGORÍA" orden="categoria" filtros={o} grupo="alertasOrden" /></span>
        <span><TituloOrden texto="ALERTA" orden="alerta" filtros={o} grupo="alertasOrden" /></span>
        <span><TituloOrden texto="PRIORIDAD" orden="prioridad" filtros={o} grupo="alertasOrden" /></span>
      </div>

      {filas.map(f => (
        <button key={f.categoria + f.item.id} className="alerta-fila fila-boton" data-accion="ver-producto" onClick={() => verProducto(f.categoria, f.item.id)}>
          <span className="fila-insumo">{f.item.nombre}</span>
          <span className="alerta-fila-categoria"><span className={`pastilla ${f.categoria === 'Salud' ? 'azul' : 'verde'}`}>{nombreCategoria(f.categoria)}</span></span>
          <span className="alerta-fila-tipo"><PastillasProblemas problemas={f.problemas} /></span>
          <span className="alerta-fila-prioridad"><span className={`pastilla ${coloresPrioridad[f.prioridad]}`}>{f.prioridad}</span></span>
        </button>
      ))}

      {filas.length === 0 && <div className="vacio">Todo en orden, no hay alertas</div>}
    </div>
  );
}

export function Inicio() {
  const estado = useEstado();
  return (
    <>
      <Encabezado titulo="Inicio" />
      <Recuadros estado={estado} />

      <div className="panel-medio">
        <Grafico estado={estado} />
        <PanelSobrestock estado={estado} />
      </div>

      <div className="panel-bajo">
        <MovimientosRecientes estado={estado} />
        <OtrasAlertas estado={estado} />
      </div>
    </>
  );
}
