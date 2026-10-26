// la ventana abierta segun estado.modal.tipo
import { estado } from '../estado.js';
import { calcularAlertas } from '../logica/alertas.js';
import { ModalMovimiento, ModalProducto, ModalAjuste, ModalUnir, ModalBaja, ModalElegir, ModalDonador, ModalUsuario } from './Modales.jsx';
import { ModalLoteMetodo, ModalLoteManual, ModalLoteCodigo, ModalLoteVoz, ModalLoteLista, ModalLoteItem } from './Lote.jsx';
import { PanelProducto, PanelMovimiento, PanelDonador, PanelActividad, PanelAlertas } from './Paneles.jsx';

const ventanas = {
  movimiento: ModalMovimiento,
  producto: ModalProducto,
  ajuste: ModalAjuste,
  unir: ModalUnir,
  baja: ModalBaja,
  elegir: ModalElegir,
  donador: ModalDonador,
  usuario: ModalUsuario,
  'lote-metodo': ModalLoteMetodo,
  'lote-manual': ModalLoteManual,
  'lote-codigo': ModalLoteCodigo,
  'lote-voz': ModalLoteVoz,
  'lote-lista': ModalLoteLista,
  'lote-item': ModalLoteItem,
  'panel-producto': PanelProducto,
  'panel-movimiento': PanelMovimiento,
  'panel-donador': PanelDonador,
  'panel-actividad': PanelActividad,
  alertas: () => <PanelAlertas alertas={calcularAlertas(estado)} />,
};

export function Ventana({ modal }) {
  const Componente = ventanas[modal.tipo];
  return Componente ? <Componente modal={modal} /> : null;
}
