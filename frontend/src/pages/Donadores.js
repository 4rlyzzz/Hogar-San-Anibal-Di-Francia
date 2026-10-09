import { Encabezado, TituloSeccion, SinResultados, escapar } from '../components/Comunes.js';
import { Alerta } from '../components/Alerta.js';

export function paginaDonadores(estado) {
  const texto = estado.busqueda.toLowerCase();
  const lista = estado.donadores.filter(d => d.nombre.toLowerCase().includes(texto));

  // cuantas veces ha donado cada uno, segun el historial
  const donaciones = nombre => estado.historial.filter(f => f.donador === nombre).length;

  return `
    ${Encabezado('Donadores', 'Personas e instituciones que donan al hogar')}
    ${Alerta(estado)}

    <form class="form-donador" id="form-donador">
      <div class="campo">
        <label>NOMBRE</label>
        <input id="nuevo-nombre" type="text" placeholder="Nombre o institución">
      </div>
      <div class="campo">
        <label>NÚMERO DE CONTACTO</label>
        <input id="nuevo-telefono" type="tel" placeholder="987 654 321">
      </div>
      <button type="submit" class="btn btn-verde">+ Agregar donador</button>
      <p class="error" id="error"></p>
    </form>

    <div class="tabla">
      <div class="tabla-header">
        ${TituloSeccion('DO', 'verde', 'Lista de donadores', `${estado.donadores.length} registrados`)}
      </div>

      <div class="donador-fila fila-titulos">
        <span>NOMBRE</span><span>NÚMERO DE CONTACTO</span><span>DONACIONES</span>
      </div>

      ${lista.map(d => `
        <div class="donador-fila">
          <span class="fila-insumo">${escapar(d.nombre)}</span>
          <span class="fila-fecha">${escapar(d.telefono)}</span>
          <span class="fila-cantidad">${donaciones(d.nombre)}</span>
        </div>
      `).join('')}

      ${lista.length === 0 ? SinResultados('Todavía no hay donadores registrados') : ''}
    </div>
  `;
}
