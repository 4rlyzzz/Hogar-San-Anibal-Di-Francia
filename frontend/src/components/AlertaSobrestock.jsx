import { IconoAlerta, IconoObjetivo, IconoDonar } from '../assets/iconos.jsx';
import { diasParaVencer, textoVencimiento } from '../logica/comunes.js';
import { calcularExcedente } from '../logica/alertas.js';

// recuadro de Inicio cuando un producto se va a desperdiciar
export function AlertaSobrestock({ item }) {
  const dias = diasParaVencer(item);
  const consumo = item.consumoDiario * dias;
  const excedente = calcularExcedente(item);
  const pctConsumo = Math.round(consumo / item.cantidad * 100);
  const grados = Math.round(dias / 30 * 360);
  const fechaTexto = textoVencimiento(item).replace('Vence ', '');

  return (
    <div className="alerta-contenedor en-pagina">
      <div className="alerta">
        <div className="alerta-header">
          <IconoAlerta />
          <div>
            <div className="alerta-titulo">Riesgo de Desperdicio por Sobrestock</div>
            <div className="alerta-sub">Alerta prioritaria · generada 09:14</div>
          </div>
        </div>

        <div className="alerta-cuerpo">
          <div className="producto">
            <div className="producto-foto">foto</div>
            <div>
              <div className="producto-nombre">{item.nombre}</div>
              <div className="producto-meta">{item.cantidad} {item.unidad}</div>
            </div>
            <div className="vencimiento">
              <div className="anillo" style={{ background: `conic-gradient(#e07b28 0deg ${grados}deg, #f4e3cf ${grados}deg 360deg)` }}>
                <div className="anillo-centro">
                  <b>{dias}</b>
                  <span>DÍAS</span>
                </div>
              </div>
              <div className="vencimiento-texto">
                <b>Vence en {dias} días</b>
                <span>{fechaTexto}</span>
              </div>
            </div>
          </div>

          <div className="comparacion">
            <div className="comparacion-titulo">
              <span>Consumo estimado vs. excedente</span>
              <span className="mono">en {item.unidad}</span>
            </div>
            <div className="comparacion-fila">
              <span className="comparacion-label">Consumo del hogar</span>
              <div className="comparacion-barra"><div className="verde" style={{ width: `${pctConsumo}%` }} /></div>
              <span className="comparacion-valor texto-verde">{consumo} {item.unidad}</span>
            </div>
            <div className="comparacion-fila">
              <span className="comparacion-label">Excedente en riesgo</span>
              <div className="comparacion-barra"><div className="naranja-fuerte" style={{ width: `${100 - pctConsumo}%` }} /></div>
              <span className="comparacion-valor texto-naranja">{excedente} {item.unidad}</span>
            </div>
            <p>Al ritmo actual de consumo, {excedente} {item.unidad} vencerían sin usarse.</p>
          </div>
        </div>

        <div className="alerta-acciones">
          <span className="rotulo">RECOMENDACIONES</span>
          <div className="consejos">
            <div className="consejo consejo-naranja">
              <IconoObjetivo />
              <b>Priorizar consumo interno</b>
            </div>
            <div className="consejo consejo-verde">
              <IconoDonar />
              <b>Donar excedente</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
