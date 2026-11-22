// la ventana abierta segun estado.modal.tipo
import { estado } from '../estado.js';
import { calcularAlertas } from '../logica/alertas.js';
import { ModalMovimiento, ModalProducto, ModalAjuste, ModalUnir, ModalBaja, ModalElegir, ModalDonador, ModalUsuario, ModalClave, ModalEditarMinimo } from './Modales.jsx';
import { ModalLoteManual, ModalLoteCodigo, ModalLoteVoz, ModalLoteLista, ModalLoteItem } from './Lote.jsx';
import { PanelProducto, PanelMovimiento, PanelDonador, PanelPersona, PanelActividad, PanelAlertas } from './Paneles.jsx';
import { ModalEditarMerch, ModalPersona } from './Merch.jsx';

const ventanas = {
  movimiento: ModalMovimiento,
  producto: ModalProducto,
  ajuste: ModalAjuste,
  unir: ModalUnir,
  baja: ModalBaja,
  elegir: ModalElegir,
  donador: ModalDonador,
  usuario: ModalUsuario,
  clave: ModalClave,
  persona: ModalPersona,
  'editar-merch': ModalEditarMerch,
  'editar-minimo': ModalEditarMinimo,
  'lote-manual': ModalLoteManual,
  'lote-codigo': ModalLoteCodigo,
  'lote-voz': ModalLoteVoz,
  'lote-lista': ModalLoteLista,
  'lote-item': ModalLoteItem,
  'panel-producto': PanelProducto,
  'panel-movimiento': PanelMovimiento,
  'panel-donador': PanelDonador,
  'panel-persona': PanelPersona,
  'panel-actividad': PanelActividad,
  alertas: () => <PanelAlertas alertas={calcularAlertas(estado)} />,
};

export function Ventana({ modal }) {
  const Componente = ventanas[modal.tipo];
  return Componente ? <Componente modal={modal} /> : null;
}
