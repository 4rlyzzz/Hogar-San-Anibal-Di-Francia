import { abrirBaja } from '../acciones.js';
import { lotesCon, ordenUso, estaVencido, cantidadVencida, fechaLote, haceDias, diasDesde, colorLote, textoVenceLote } from '../logica/lotes.js';
import { redondear } from '../logica/comunes.js';

// tabla de lotes del detalle del producto
export function TablaLotes({ item, categoria }) {
  const lotes = lotesCon(item).sort(ordenUso);
  const vencida = cantidadVencida(item);
  if (lotes.length === 0) return null;

  return (
    <>
      <div className="mov-pasos-titulo">
        <b>Lotes</b>
        <span className="lotes-ayuda">se usa primero el de arriba</span>
      </div>
      <ul className="lotes">
        {lotes.map(l => (
          <li key={l.id} className={`lote ${estaVencido(l) ? 'vencido' : ''}`}>
            <span className="lote-ingreso">
              <b>Ingresó {fechaLote(l.ingreso)}</b>
              <small>{l.origen || haceDias(diasDesde(l.ingreso))}</small>
            </span>
            <span className={`etiqueta ${colorLote(l)}`}>{textoVenceLote(l)}</span>
            <span className="lote-quedan">{l.quedan} <small>{item.unidad}</small></span>
          </li>
        ))}
      </ul>
      {vencida > 0 && (
        <button className="btn btn-blanco btn-baja" data-accion="dar-baja" onClick={() => abrirBaja(categoria, item.id)}>
          Dar de baja lo vencido ({vencida} {item.unidad})
        </button>
      )}
    </>
  );
}

// lotes que se usan en una salida
export function LotesSalida({ plan, unidad }) {
  return (
    <div className="lotes-salida">
      <div className="mov-pasos-titulo">
        <b>De qué lotes sale</b>
        <span className="lotes-ayuda">primero lo que vence antes</span>
      </div>
      <ul className="lotes">
        {plan.map(({ lote, cantidad }) => (
          <li key={lote.id} className="lote lote-sale">
            <span className="lote-ingreso">
              <b>Ingresó {fechaLote(lote.ingreso)}</b>
              <small className={`texto-${colorLote(lote)}`}>{textoVenceLote(lote)}</small>
            </span>
            <span className="lote-menos">−{cantidad}</span>
            <span className="lote-quedan">{lote.quedan} → {redondear(lote.quedan - cantidad)} <small>{unidad}</small></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
