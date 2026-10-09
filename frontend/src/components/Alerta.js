import { iconoAlerta, iconoObjetivo, iconoDonar } from '../assets/icons.js';
import { diasParaVencer, textoVencimiento } from './Comunes.js';

// excedente = stock - consumo diario * dias que faltan para vencer
function calcularExcedente(item) {
  return item.cantidad - item.consumoDiario * diasParaVencer(item);
}

// se muestra en todas las pestañas: la alerta abierta o el boton para volver a abrirla
// solo aplica si quedan 15 dias o menos y sobra producto
export function Alerta(estado) {
  // por ahora solo la avena tiene datos de consumo para la alerta
  const avena = estado.alimentos.find(item => item.consumoDiario);
  if (!avena) return '';

  const dias = diasParaVencer(avena);
  if (dias <= 0 || dias > 15 || calcularExcedente(avena) <= 0) return '';

  return estado.alertaAbierta ? AlertaSobrestock(avena) : BotonAlerta();
}

export function AlertaSobrestock(item) {
  const dias = diasParaVencer(item);
  const consumo = item.consumoDiario * dias;
  const excedente = calcularExcedente(item);
  const pctConsumo = Math.round(consumo / item.cantidad * 100);
  const grados = Math.round(dias / 30 * 360);
  const fechaTexto = textoVencimiento(item).replace('Vence ', '');

  return `
    <div class="alerta-contenedor">
      <div class="alerta">
        <div class="alerta-header">
          ${iconoAlerta}
          <div>
            <div class="alerta-titulo">Riesgo de Desperdicio por Sobrestock</div>
            <div class="alerta-sub">Alerta prioritaria · generada 09:14</div>
          </div>
          <button class="btn-cerrar naranja-claro" data-accion="cerrar-alerta">×</button>
        </div>

        <div class="alerta-cuerpo">
          <div class="producto">
            <div class="producto-foto">foto</div>
            <div>
              <div class="producto-nombre">${item.nombre}</div>
              <div class="producto-meta">${item.cantidad} ${item.unidad}</div>
            </div>
            <div class="vencimiento">
              <div class="anillo" style="background: conic-gradient(#e07b28 0deg ${grados}deg, #f4e3cf ${grados}deg 360deg)">
                <div class="anillo-centro">
                  <b>${dias}</b>
                  <span>DÍAS</span>
                </div>
              </div>
              <div class="vencimiento-texto">
                <b>Vence en ${dias} días</b>
                <span>${fechaTexto}</span>
              </div>
            </div>
          </div>

          <div class="comparacion">
            <div class="comparacion-titulo">
              <span>Consumo estimado vs. excedente</span>
              <span class="mono">en ${item.unidad}</span>
            </div>
            <div class="comparacion-fila">
              <span class="comparacion-label">Consumo del hogar</span>
              <div class="comparacion-barra"><div class="verde" style="width: ${pctConsumo}%"></div></div>
              <span class="comparacion-valor texto-verde">${consumo} ${item.unidad}</span>
            </div>
            <div class="comparacion-fila">
              <span class="comparacion-label">Excedente en riesgo</span>
              <div class="comparacion-barra"><div class="naranja-fuerte" style="width: ${100 - pctConsumo}%"></div></div>
              <span class="comparacion-valor texto-naranja">${excedente} ${item.unidad}</span>
            </div>
            <p>Al ritmo actual de consumo, ${excedente} ${item.unidad} vencerían sin usarse.</p>
          </div>
        </div>

        <div class="alerta-acciones">
          <span class="rotulo">ACCIONES RECOMENDADAS</span>
          <div class="consejo consejo-naranja">
            ${iconoObjetivo}
            <div>
              <b>Priorizar consumo interno</b>
              <span>Incluir avena en el menú de desayuno de los próximos ${dias} días.</span>
            </div>
          </div>
          <div class="consejo consejo-verde">
            ${iconoDonar}
            <div>
              <b>Donar excedente a red de hogares</b>
              <span>Solo un administrador puede derivar los ${excedente} ${item.unidad} a la red de hogares.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function BotonAlerta() {
  return `
    <button class="boton-alerta" data-accion="abrir-alerta">
      ${iconoAlerta} 1 alerta de sobrestock <span>VER</span>
    </button>
  `;
}
