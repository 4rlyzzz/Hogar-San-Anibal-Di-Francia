// en celular las ventanas suben desde abajo; aqui se cierran arrastrandolas hacia abajo
// solo se arrastra desde la parte de arriba (rayita y titulo) para no pelear con el scroll

const hojas = '.modal, .panel-actividad, .panel-filtros';
const zonaArrastre = 80;      // px desde el borde de arriba de la hoja
const distanciaCierre = 110;  // px que hay que bajarla para que se cierre
const velocidadCierre = 0.6;  // px/ms: un deslizon rapido tambien la cierra

const esCelular = () => window.matchMedia('(max-width: 767px)').matches;

// alCerrar(hoja): lo que hay que hacer cuando se suelta abajo (cerrar modal o filtros)
export function activarDeslizar(alCerrar) {
  let arrastre = null;

  document.addEventListener('touchstart', e => {
    if (!esCelular() || e.touches.length !== 1) return;
    const hoja = e.target.closest(hojas);
    if (!hoja) return;

    const toque = e.touches[0];
    if (toque.clientY - hoja.getBoundingClientRect().top > zonaArrastre) return;
    // no robar el toque a botones, campos o desplegables de la cabecera
    if (e.target.closest('button, input, select, label, a')) return;

    arrastre = { hoja, inicioY: toque.clientY, inicioT: e.timeStamp, dy: 0 };
    hoja.style.transition = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!arrastre) return;
    // solo hacia abajo; hacia arriba se queda en su lugar
    arrastre.dy = Math.max(0, e.touches[0].clientY - arrastre.inicioY);
    arrastre.hoja.style.transform = `translateY(${arrastre.dy}px)`;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!arrastre) return;
    const { hoja, dy, inicioT } = arrastre;
    arrastre = null;

    const velocidad = dy / Math.max(1, e.timeStamp - inicioT);
    hoja.style.transition = 'transform 0.2s ease';

    if (dy > distanciaCierre || (dy > 30 && velocidad > velocidadCierre)) {
      hoja.style.transform = 'translateY(100%)';
      setTimeout(() => alCerrar(hoja), 180);
    } else {
      hoja.style.transform = '';
    }
  });
}
