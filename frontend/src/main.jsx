import './styles/global.css';
import './styles/componentes.css';
import './styles/responsive.css';
import './styles/login.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { estado } from './estado.js';
import { iniciar, cerrarModal, cerrarFiltros, cambiar, mostrarToast } from './acciones.js';
import { activarDeslizar } from './components/Deslizar.js';

iniciar();
createRoot(document.querySelector('#app')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
quitarPantallaCarga();

// celular: deslizar hacia abajo cierra el panel
activarDeslizar(hoja => (hoja.classList.contains('panel-filtros') ? cerrarFiltros() : cerrarModal()));

// Escape vuelve a la ventana anterior (o la cierra), y cierra los filtros y el menu del usuario
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (estado.modal?.volver) estado.modal.volver();
  else if (estado.modal) cerrarModal();
  if (estado.filtrosAbiertos) cerrarFiltros();
  if (estado.menuUsuario) cambiar(x => (x.menuUsuario = false));
});

// fecha vacia: el "dd/mm/aaaa" lo dibuja el navegador como si ya estuviera escrito.
// data-vacia lo pinta gris como los demas ejemplos (global.css). Se revisa al aparecer
// un campo nuevo y al escribir o marcar algo ("No tiene fecha" la borra sin evento propio)
const marcarFechas = () => {
  for (const campo of document.querySelectorAll('input[type="date"]')) campo.toggleAttribute('data-vacia', !campo.value);
};
new MutationObserver(marcarFechas).observe(document.querySelector('#app'), { childList: true, subtree: true });
document.addEventListener('input', marcarFechas, true);
document.addEventListener('change', marcarFechas, true);

// celular: el teclado tapaba el campo donde se escribe. Cuando el teclado termina de subir
// (cambia el alto visible), el campo se lleva al centro de lo que se ve.
// En Android ademas la pagina se achica con el teclado (interactive-widget en index.html)
// (el buscador de arriba no: ya esta a la vista y moverlo desordena la pagina)
const esCampoDeTexto = el => el?.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea') && !el.closest('.topbar');
const mostrarCampo = () => {
  const campo = document.activeElement;
  if (esCampoDeTexto(campo) && window.matchMedia('(max-width: 767px)').matches) {
    campo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
};
window.visualViewport?.addEventListener('resize', mostrarCampo);
// por si el teclado ya estaba abierto (se pasa de un campo a otro): no cambia el alto
document.addEventListener('focusin', e => {
  if (esCampoDeTexto(e.target)) setTimeout(mostrarCampo, 350);
});

// errores que no se esperaban: se avisa y la app sigue funcionando
window.addEventListener('error', () => mostrarToast('Ocurrió un error inesperado. Revisa el historial antes de volver a intentarlo.'));
window.addEventListener('unhandledrejection', e => {
  console.error(e.reason);
  mostrarToast('Ocurrió un error inesperado. Vuelve a intentarlo.');
});

// quita la pantalla de carga (minimo 1.4 s)
function quitarPantallaCarga() {
  const pantalla = document.querySelector('#pantalla-carga');
  const minimo = 1400;

  setTimeout(() => {
    pantalla.classList.add('oculta');
    pantalla.addEventListener('transitionend', () => pantalla.remove(), { once: true });
  }, Math.max(0, minimo - performance.now()));
}
