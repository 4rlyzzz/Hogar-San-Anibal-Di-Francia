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
