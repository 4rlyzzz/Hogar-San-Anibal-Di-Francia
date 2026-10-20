import { Encabezado, TituloSeccion, escapar } from '../components/Comunes.js';
import { Alerta } from '../components/Alerta.js';

export function paginaHistorial(estado) {
  const texto = estado.busqueda.toLowerCase();
  const filas = estado.historial.filter(f =>
    (f.insumo + ' ' + f.responsable + ' ' + f.donador + ' ' + f.para).toLowerCase().includes(texto)
  );

  return `
    ${Encabezado('Historial', 'Movimientos de ingreso y salida registrados por el equipo')}
    ${Alerta(estado)}

    <div class="tabla">
      <div class="tabla-header">
        ${TituloSeccion('HI', 'gris', 'Historial de movimientos', 'últimos 7 días')}
      </div>

      <div class="fila fila-titulos">
        <span>FECHA</span><span>INSUMO</span><span>CATEGORÍA</span><span>MOVIMIENTO</span><span>CANTIDAD</span><span>RESPONSABLE</span>
      </div>

      ${filas.map(f => `
        <div class="fila ${f.movimiento === 'Ingreso' ? 'ingreso' : 'salida'}">
          <span class="fila-fecha">${f.fecha}</span>
          <span class="fila-insumo">
            ${escapar(f.insumo)}
            ${f.donador ? `<small>Donado por ${escapar(f.donador)}</small>` : ''}
            ${f.para ? `<small>Para: ${escapar(f.para)}</small>` : ''}
          </span>
          <span class="fila-categoria"><span class="pastilla ${f.categoria === 'Salud' ? 'azul' : 'verde'}">${f.categoria}</span></span>
          <span class="fila-movimiento">● ${f.movimiento}</span>
          <span class="fila-cantidad">${f.movimiento === 'Ingreso' ? '+' : '−'}${f.cantidad} ${escapar(f.unidad)}</span>
          <span class="fila-responsable">${f.responsable}</span>
        </div>
      `).join('')}

      ${filas.length === 0 ? '<div class="vacio">Sin movimientos</div>' : ''}
    </div>
  `;
}
