// paneles que salen por la derecha (en celular, desde abajo): producto, movimiento, donador, actividad y alertas
import { useEstado } from '../estado.js';
import { usuario } from '../data/datos.js';
import { IconoAjustar, IconoSalida, IconoIngreso } from '../assets/iconos.jsx';
import {
  cerrarModal, abrirMovimiento, abrirAjuste, abrirUnir, historialProducto, movimientosDe, verMovimiento, corregirAjuste,
  filtrarProducto, historialDonador, verProducto, cambiarRol, cambiarActivo, esAdmin, roles,
} from '../acciones.js';
import {
  nombreCategoria, colorVencimiento, textoCambio, textoStock, textoPresentacion, textoTotal, disponible, stockAntes,
  movimientosEntre, iniciales, fechaDe, fechaLarga, textoFecha, tiempoRelativo, mismoId, textoPara,
} from '../logica/comunes.js';
import { fechaVence } from '../logica/lotes.js';
import { problemasDe, coloresPrioridad, orden, grupos } from '../logica/alertas.js';
import { actividadesDe } from '../logica/donadores.js';
import { actividadDe, coloresActividad, nombreDia } from '../logica/actividad.js';
import { Fondo, BotonVolver } from './Formulario.jsx';
import { Desplegable } from './Desplegable.jsx';
import { MovimientosEntre, clasesMovimiento } from './Comunes.jsx';
import { TablaLotes } from './Lotes.jsx';

function Cerrar() {
  return <button type="button" className="btn-cerrar" data-accion="cerrar-modal" onClick={cerrarModal} aria-label="Cerrar">×</button>;
}

// ---------- problemas de un producto ----------
// en franjas de color (detalle del producto)
export function ListaProblemas({ problemas }) {
  return (
    <span className="lista-alertas">
      {problemas.map(p => (
        <span key={p.tipo} className={`lista-alertas-item ${coloresPrioridad[p.prioridad]}`}>
          <span className={`actividad-punto ${coloresPrioridad[p.prioridad]}`} />
          <span><b>{p.tipo}</b> · {p.detalle}</span>
        </span>
      ))}
    </span>
  );
}

// en una linea (tabla de Inicio)
export function PastillasProblemas({ problemas }) {
  return problemas.map(p => (
    <span key={p.tipo} className={`pastilla-alerta ${coloresPrioridad[p.prioridad]}`} title={`${p.tipo}: ${p.detalle}`}>
      <b>{p.tipo}</b> · {p.corto}
    </span>
  ));
}

// ---------- detalle del producto ----------
// nombre visible de cada campo
const etiquetasProducto = { unidad: 'Se cuenta en', minimo: 'Stock mínimo', consumoDiario: 'Consumo diario', unidos: 'Se le unió' };
// campos que no se listan
const internosProducto = ['id', 'codigo', 'nombre', 'cantidad', 'lotes', 'vencimiento', 'lote', 'contenido', 'medida', '_id', '_rev', 'tipo', 'categoria', 'envase'];
// movimientos recientes que se muestran
const ultimos = 8;

// cuenta solo lo que se puede usar (sin lo vencido)
function estadoStock(item) {
  const sirve = disponible(item);
  if (sirve < item.minimo) return { color: 'rojo', texto: 'Bajo el stock mínimo' };
  if (sirve <= item.minimo * 1.2) return { color: 'naranja', texto: 'Cerca del mínimo' };
  return { color: 'verde', texto: 'Sobre el mínimo' };
}

function DatosProducto({ item }) {
  const filas = Object.entries(item)
    .filter(([campo, valor]) => !internosProducto.includes(campo) && valor !== '' && valor != null)
    .map(([campo, valor]) => {
      const conUnidad = campo === 'minimo' || campo === 'consumoDiario' ? ` ${item.unidad}` : '';
      return [campo, `${Array.isArray(valor) ? valor.join(', ') : valor}${conUnidad}`];
    });

  return (
    <dl className="mov-datos">
      <div><dt>Presentación</dt><dd>{textoPresentacion(item) || 'Suelto, en ' + item.unidad}</dd></div>
      {filas.map(([campo, valor]) => <div key={campo}><dt>{etiquetasProducto[campo] || campo}</dt><dd>{valor}</dd></div>)}
    </dl>
  );
}

export function PanelProducto({ modal }) {
  useEstado();
  const { item, categoria } = modal;
  const estadoProducto = estadoStock(item);
  const problemas = problemasDe(item);
  const movimientos = movimientosDe(item, categoria);

  return (
    <Fondo panel>
      <aside className="panel-actividad panel-movimiento" aria-label={item.nombre}>
        <div className="panel-actividad-cabecera">
          <BotonVolver />
          <span className={`tarjeta-codigo ${colorVencimiento(item)}`}>{item.codigo}</span>
          <div>
            <div className="modal-titulo">{item.nombre}</div>
            <div className="modal-sub">{nombreCategoria(categoria)}</div>
          </div>
          <Cerrar />
        </div>

        <div className="panel-movimiento-cuerpo">
          <div className="producto-stock">
            <div>
              <b>{item.cantidad} <small>{item.unidad}</small></b>
              {textoPresentacion(item) && <span className="producto-total">{textoPresentacion(item)} · {textoTotal(item)}</span>}
            </div>
            {problemas.length === 0 && <span className={`texto-${estadoProducto.color}`}>● {estadoProducto.texto}</span>}
          </div>

          {problemas.length > 0 && <div className="producto-alertas"><ListaProblemas problemas={problemas} /></div>}

          <div className="botones producto-botones">
            <button className="btn btn-registrar btn-salida" data-accion="registrar" data-tipo="Salida" onClick={() => abrirMovimiento(categoria, item.id, 'Salida')}><IconoSalida /> Registrar salida</button>
            <button className="btn btn-registrar btn-ingreso" data-accion="registrar" data-tipo="Ingreso" onClick={() => abrirMovimiento(categoria, item.id, 'Ingreso')}><IconoIngreso /> Registrar ingreso</button>
          </div>
          <button className="btn btn-blanco btn-contar" data-accion="ajustar" onClick={() => abrirAjuste(categoria, item.id)}>
            <IconoAjustar /> Contar y corregir stock
          </button>

          <DatosProducto item={item} />

          <TablaLotes item={item} categoria={categoria} />

          <div className="mov-pasos-titulo">
            <b>Últimos movimientos</b>
            {movimientos.length > 0 && <button className="link" data-accion="historial-producto" onClick={() => historialProducto(item, categoria)}>Ver todo en historial</button>}
          </div>
          <ul className="mov-pasos">
            {movimientos.slice(0, ultimos).map(p => (
              <li key={p.indice}>
                <button className={`mov-paso ${clasesMovimiento[p.fila.movimiento]}`} data-accion="ver-movimiento" onClick={() => verMovimiento(p.indice)}>
                  <span className="mov-paso-fecha">{p.fila.fecha}</span>
                  <span className="mov-paso-tipo">● {p.fila.inicial ? 'Registro inicial' : p.fila.movimiento}{p.fila.insumo !== item.nombre && <> <small>de "{p.fila.insumo}"</small></>}</span>
                  <span className="mov-paso-cambio">{textoCambio(p.fila)}</span>
                  <span className="mov-paso-stock">{textoStock(p.fila)}</span>
                </button>
              </li>
            ))}
            {movimientos.length === 0 && <li className="vacio">Todavía no tiene movimientos</li>}
          </ul>

          {esAdmin() && (
            <button className="btn btn-blanco btn-unir" data-accion="unir-producto" onClick={() => abrirUnir(categoria, item.id)}>
              ¿Está repetido? Unir con otro producto
            </button>
          )}
        </div>
      </aside>
    </Fondo>
  );
}

// ---------- detalle de un movimiento ----------
// campos que no se listan
const yaMostrados = ['fecha', 'insumo', 'categoria', 'movimiento', 'cantidad', 'diferencia', 'unidad', 'saldo', 'inicial', 'corrige', 'loteId', '_id', '_rev', 'tipo', 'fechaOrden'];
// nombre visible de cada campo
const etiquetasMovimiento = { responsable: 'Responsable', donador: 'Donado por', actividad: 'Actividad', para: 'Para (niño/a)', motivo: 'Motivo', nota: 'Detalle', observaciones: 'Observaciones', lote: 'Lote', vence: 'Vence', lotes: 'Salió de' };

// campos que necesitan formato
function textoCampo(campo, valor, fila) {
  if (campo === 'lotes') return valor.map(l => `Lote del ${l.ingreso}: ${l.cantidad} ${fila.unidad}`).join(' · ');
  if (campo === 'vence') return fechaVence(valor);
  if (campo === 'para') return textoPara(fila);
  return String(valor);
}

function DatosMovimiento({ fila }) {
  // no muestra listas vacias
  const filas = Object.entries(fila)
    .filter(([campo, valor]) => !yaMostrados.includes(campo) && valor !== '' && valor != null && !(Array.isArray(valor) && !valor.length));
  if (filas.length === 0) return null;
  return (
    <dl className="mov-datos">
      {filas.map(([campo, valor]) => <div key={campo}><dt>{etiquetasMovimiento[campo] || campo}</dt><dd>{textoCampo(campo, valor, fila)}</dd></div>)}
    </dl>
  );
}

// cuanto habia y cuanto quedo, en grande
function AntesDespues({ fila }) {
  if (fila.saldo == null) return <p className="mov-sin-saldo">Este movimiento es anterior al registro de saldos: no se sabe cuánto había.</p>;
  return (
    <div className="mov-cambio">
      <div><span>ANTES</span><b>{stockAntes(fila)}</b><small>{fila.unidad}</small></div>
      <div className={`mov-flecha ${clasesMovimiento[fila.movimiento]}`}><span>→</span><em>{textoCambio(fila)}</em></div>
      <div><span>DESPUÉS</span><b>{fila.saldo}</b><small>{fila.unidad}</small></div>
    </div>
  );
}

// enlaces entre un ajuste y su correccion
function Correccion({ fila, corrige, corregidoPor }) {
  return (
    <>
      {corrige && (
        <div className="correccion">
          <div className="correccion-titulo">
            <b>Corrige el conteo del {corrige.fila.fecha}</b>
            <button className="link" data-accion="ver-movimiento" onClick={() => verMovimiento(corrige.indice)}>Ver ese conteo</button>
          </div>
          <p>Ese día el sistema decía <b>{stockAntes(corrige.fila)} {fila.unidad}</b> y {corrige.fila.responsable} contó <b>{corrige.fila.saldo} {fila.unidad}</b>.</p>
          <span className="correccion-sub">Después de ese conteo hubo</span>
          <MovimientosEntre pasos={corrige.entre} unidad={fila.unidad} navegable />
          <p>Con eso el sistema decía <b>{stockAntes(fila)} {fila.unidad}</b>, pero al volver a contar había <b>{fila.saldo} {fila.unidad}</b>.</p>
        </div>
      )}
      {corregidoPor && (
        <div className="correccion">
          <div className="correccion-titulo">
            <b>Este conteo estaba mal</b>
            <button className="link" data-accion="ver-movimiento" onClick={() => verMovimiento(corregidoPor.indice)}>Ver corrección</button>
          </div>
          <p>{corregidoPor.fila.responsable} volvió a contar el {corregidoPor.fila.fecha} y había <b>{corregidoPor.fila.saldo} {fila.unidad}</b>.</p>
        </div>
      )}
    </>
  );
}

export function PanelMovimiento({ modal }) {
  const estado = useEstado();
  const { indice } = modal;
  const fila = estado.historial[indice];
  const pasos = estado.historial
    .map((f, i) => ({ fila: f, indice: i }))
    .filter(p => p.fila.insumo === fila.insumo && p.fila.categoria === fila.categoria)
    .slice(0, 40);

  // ajuste que corrige y quien lo corrigio
  const iCorrige = fila.corrige ? estado.historial.indexOf(fila.corrige) : -1;
  const iCorregidoPor = estado.historial.findIndex(f => f.corrige === fila);
  const corrige = iCorrige >= 0 ? { fila: fila.corrige, indice: iCorrige, entre: movimientosEntre(estado.historial, fila.corrige, fila) } : null;
  const corregidoPor = iCorregidoPor >= 0 ? { fila: estado.historial[iCorregidoPor], indice: iCorregidoPor } : null;

  return (
    <Fondo panel>
      <aside className="panel-actividad panel-movimiento" aria-label="Detalle del movimiento">
        <div className="panel-actividad-cabecera">
          <BotonVolver />
          <span className={`pastilla mov-tipo ${clasesMovimiento[fila.movimiento]}`}>{fila.inicial ? 'Registro inicial' : fila.movimiento}</span>
          <div>
            <div className="modal-titulo">{fila.insumo}</div>
            <div className="modal-sub">{fila.fecha} · {nombreCategoria(fila.categoria)}</div>
          </div>
          <Cerrar />
        </div>

        <div className="panel-movimiento-cuerpo">
          <AntesDespues fila={fila} />
          <Correccion fila={fila} corrige={corrige} corregidoPor={corregidoPor} />
          {fila.movimiento === 'Ajuste' && !corregidoPor && (
            <button className="btn btn-blanco btn-corregir" data-accion="corregir-ajuste" onClick={() => corregirAjuste(indice)}>
              ¿Se contó mal? Corregir este ajuste
            </button>
          )}
          <DatosMovimiento fila={fila} />

          <div className="mov-pasos-titulo">
            <b>Pasos de este producto</b>
            <button className="link" data-accion="filtrar-producto" onClick={() => filtrarProducto(fila)}>Ver en historial</button>
          </div>
          <ul className="mov-pasos">
            {pasos.map(p => (
              <li key={p.indice}>
                <button className={`mov-paso ${clasesMovimiento[p.fila.movimiento]} ${p.indice === indice ? 'actual' : ''}`} data-accion="ver-movimiento" onClick={() => verMovimiento(p.indice)}>
                  <span className="mov-paso-fecha">{p.fila.fecha}</span>
                  <span className="mov-paso-tipo">● {p.fila.inicial ? 'Registro inicial' : p.fila.movimiento}</span>
                  <span className="mov-paso-cambio">{textoCambio(p.fila)}</span>
                  <span className="mov-paso-stock">{textoStock(p.fila)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </Fondo>
  );
}

// ---------- detalle de un donador ----------
export function PanelDonador({ modal }) {
  const estado = useEstado();
  const d = modal.donador;
  const donaciones = estado.historial.filter(f => f.movimiento === 'Ingreso' && f.donador === d.nombre);
  const actividades = actividadesDe(donaciones);
  const ultima = donaciones[0];
  const telefono = d.telefono.replace(/[^\d+]/g, '');

  return (
    <Fondo panel>
      <aside className="panel-actividad" aria-label={`Donaciones de ${d.nombre}`}>
        <div className="panel-actividad-cabecera">
          <BotonVolver />
          <span className="avatar avatar-verde">{iniciales(d.nombre)}</span>
          <div>
            <div className="modal-titulo">{d.nombre}</div>
            <div className="modal-sub">
              <a href={`tel:${telefono}`} className="link-telefono">{d.telefono}</a>
              {d.creadoPor && ` · agregado por ${d.creadoPor}`}
            </div>
          </div>
          <Cerrar />
        </div>

        <div className="panel-actividad-resumen tres">
          <div><b>{donaciones.length}</b><span>donaciones</span></div>
          <div><b>{actividades.length}</b><span>actividades</span></div>
          <div><b>{ultima ? fechaLarga(fechaDe(ultima.fecha)) : '—'}</b><span>última donación</span></div>
        </div>

        {actividades.length > 0 && (
          <div className="donador-apoyo">
            <span>APOYÓ EN</span>
            <div>{actividades.map(([a, n]) => <span key={a} className="pastilla-actividad">{a} <b>×{n}</b></span>)}</div>
          </div>
        )}

        <ul className="panel-actividad-lista">
          {donaciones.map((x, i) => {
            const anio = String(fechaDe(x.fecha).getFullYear());
            const anioAnterior = i > 0 ? String(fechaDe(donaciones[i - 1].fecha).getFullYear()) : '';
            return [
              anio !== anioAnterior && <li key={'a' + i} className="actividad-dia">{anio}</li>,
              <li key={i} className="actividad-item">
                <span className="actividad-punto verde" />
                <div>
                  <b>{x.insumo} · +{x.cantidad} {x.unidad}</b>
                  <small>{x.actividad || 'Sin actividad'} · recibió {x.responsable}</small>
                </div>
                <span className="actividad-hora">{x.fecha.split(' ').slice(0, 2).join(' ')}</span>
              </li>,
            ];
          })}
          {donaciones.length === 0 && <li className="vacio">Todavía no registra donaciones</li>}
        </ul>

        {donaciones.length > 0 && (
          <div className="panel-donador-pie">
            <button className="link" data-accion="historial-donador" onClick={() => historialDonador(d)}>Ver sus donaciones en el historial →</button>
          </div>
        )}
      </aside>
    </Fondo>
  );
}

// ---------- actividad de una cuenta ----------
// cuantos registros se muestran (los mas recientes)
const limite = 60;

export function PanelActividad({ modal }) {
  const estado = useEstado();
  const { cuenta } = modal;
  const esPropio = mismoId(cuenta.id, usuario.id);
  // el admin viendo otra cuenta puede cambiar su rol y activarla
  const administrar = !esPropio && esAdmin();
  const items = actividadDe(estado, cuenta);
  const ingresos = items.filter(i => i.accion === 'ingreso').length;
  const salidas = items.filter(i => i.accion === 'salida').length;
  const visibles = items.slice(0, limite);

  return (
    <Fondo panel>
      <aside className="panel-actividad" aria-label={`Actividad de ${cuenta.nombre}`}>
        <div className="panel-actividad-cabecera">
          <BotonVolver />
          <span className={`avatar ${cuenta.rol === 'Administrador' ? '' : 'avatar-verde'}`}>{iniciales(cuenta.nombre)}</span>
          <div>
            <div className="modal-titulo">{esPropio ? 'Mi actividad' : cuenta.nombre}</div>
            <div className="modal-sub">@{cuenta.usuario} · {cuenta.rol}{cuenta.activo ? '' : ' · desactivado'}</div>
          </div>
          <Cerrar />
        </div>

        {administrar && (
          <div className="panel-actividad-controles">
            <div className="panel-actividad-rol">
              <span id="rol-panel">Rol</span>
              <Desplegable variante="rol" className="selector-rol" data-id={cuenta.id} aria-labelledby="rol-panel" valor={cuenta.rol} onChange={r => cambiarRol(cuenta.id, r)} opciones={roles.map(r => [r, r])} />
            </div>
            <button className={`btn-mini ${cuenta.activo ? 'btn-mini-rojo' : ''}`} data-accion="activar-usuario" data-id={cuenta.id} onClick={() => cambiarActivo(cuenta.id)}>
              {cuenta.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
            </button>
          </div>
        )}

        <div className="panel-actividad-resumen">
          <div><b>{ingresos}</b><span>ingresos</span></div>
          <div><b>{salidas}</b><span>salidas</span></div>
          <div><b>{items.length - ingresos - salidas}</b><span>otras acciones</span></div>
          <div><b>{cuenta.ultimoAcceso ? tiempoRelativo(cuenta.ultimoAcceso) : '—'}</b><span>último acceso</span></div>
        </div>

        <ul className="panel-actividad-lista">
          {visibles.map((i, n) => {
            const dia = nombreDia(i.fecha);
            const diaAnterior = n > 0 ? nombreDia(visibles[n - 1].fecha) : '';
            return [
              dia !== diaAnterior && <li key={'d' + n} className="actividad-dia">{dia}</li>,
              <li key={n} className="actividad-item">
                <span className={`actividad-punto ${coloresActividad[i.accion] || 'gris'}`} />
                <div>
                  <b>{i.texto}</b>
                  {i.detalle && <small>{i.detalle}</small>}
                </div>
                <span className="actividad-hora">{textoFecha(i.fecha).split(' ')[2]}</span>
              </li>,
            ];
          })}
          {visibles.length === 0 && <li className="vacio">Todavía no hay actividad</li>}
          {items.length > limite && <li className="actividad-mas">Mostrando las {limite} más recientes de {items.length}</li>}
        </ul>
      </aside>
    </Fondo>
  );
}

// ---------- panel de la campanita ----------
export function PanelAlertas({ alertas }) {
  const urgentes = alertas.filter(a => a.prioridad === 'Alta').length;

  return (
    <Fondo panel>
      <aside className="panel-actividad" aria-label="Alertas">
        <div className="panel-actividad-cabecera">
          <BotonVolver />
          <div>
            <div className="modal-titulo">Alertas</div>
            <div className="modal-sub">{urgentes ? `${urgentes} urgentes de ${alertas.length}` : `${alertas.length} para revisar`}</div>
          </div>
          <Cerrar />
        </div>

        <ul className="panel-actividad-lista">
          {orden.map(prioridad => {
            const delGrupo = alertas.filter(a => a.prioridad === prioridad);
            if (delGrupo.length === 0) return null;
            return [
              <li key={prioridad} className="actividad-dia">{grupos[prioridad]} · {delGrupo.length}</li>,
              ...delGrupo.map(a => (
                <li key={prioridad + a.categoria + a.item.id}>
                  <button className="actividad-item alerta-item" data-accion="ver-producto" onClick={() => verProducto(a.categoria, a.item.id)}>
                    <span className={`actividad-punto ${coloresPrioridad[a.prioridad]}`} />
                    <span>
                      <b>{a.item.nombre}</b>
                      <small>{a.tipo} · {a.detalle}</small>
                    </span>
                    <span className="actividad-hora">{nombreCategoria(a.categoria)}</span>
                  </button>
                </li>
              )),
            ];
          })}
          {alertas.length === 0 && <li className="vacio">Todo en orden, no hay alertas</li>}
        </ul>
      </aside>
    </Fondo>
  );
}
