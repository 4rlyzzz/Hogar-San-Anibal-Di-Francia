// estado de toda la app; las acciones lo cambian y llaman a refrescar() para que React vuelva a dibujar
import { useSyncExternalStore } from 'react';
import { alimentos, salud, historial, donadores, cuentas, actividad } from './data/datos.js';
import { inventarioVacio } from './logica/inventario.js';
import { filtrosHistorialVacios } from './logica/historial.js';

export const estado = {
  seccion: 'Inicio',
  grafico: { vista: 'Movimientos', periodo: 'Mes', categoria: 'Alimentos' },
  usuarios: { rol: 'Todos', estado: 'Todos', orden: 'acceso', invertido: false },
  alertasOrden: { orden: 'prioridad', invertido: false },
  historialFiltros: filtrosHistorialVacios(),
  donadoresFiltros: { actividad: 'Todos', anio: 'Todos' },
  inventarioFiltros: inventarioVacio(),
  // panel de filtros abierto (o null)
  filtrosAbiertos: null,
  filtro: 'Todos',
  busqueda: '',
  // ventana abierta: { tipo, ... } o null
  modal: null,
  // lista de varios productos que se esta armando (o null)
  lote: null,
  toast: null,
  menuUsuario: false,
  menuFijo: false,
  alimentos,
  salud,
  historial,
  donadores,
  cuentas,
  actividad,
};

let version = 0;
const oyentes = new Set();

export function refrescar() {
  version++;
  oyentes.forEach(oyente => oyente());
}

function suscribirse(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

// los componentes que lo usan se vuelven a dibujar en cada refrescar()
export function useEstado() {
  useSyncExternalStore(suscribirse, () => version);
  return estado;
}
