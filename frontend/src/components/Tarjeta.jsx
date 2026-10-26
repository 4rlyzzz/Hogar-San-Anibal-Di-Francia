import { IconoSalida, IconoIngreso } from '../assets/iconos.jsx';
import { verProducto, abrirMovimiento } from '../acciones.js';
import { colorVencimiento, textoVencimiento, textoPresentacion, disponible, cantidadVencida } from '../logica/comunes.js';

// misma tarjeta para alimentos y salud
// el ajuste esta en el detalle del producto
export function Tarjeta({ item, categoria }) {
  const sirve = disponible(item);
  const vencida = cantidadVencida(item);
  let color = 'verde';
  let mensaje = 'Stock sobre el mínimo';
  if (sirve < item.minimo) {
    color = 'rojo';
    mensaje = 'Bajo stock mínimo';
  } else if (sirve <= item.minimo * 1.2) {
    color = 'naranja';
    mensaje = 'Cerca del mínimo';
  }
  const colorVence = colorVencimiento(item);

  return (
    <div className="tarjeta">
      <div className="tarjeta-top">
        <div className={`tarjeta-codigo ${colorVence}`}>{item.codigo}</div>
        <div className="tarjeta-info">
          <span className="tarjeta-nombre">{item.nombre}</span>
          {textoPresentacion(item) && <span className="tarjeta-descripcion">{textoPresentacion(item)}</span>}
          <button className="tarjeta-ver" data-accion="ver-producto" onClick={() => verProducto(categoria, item.id)}>Ver detalle ›</button>
        </div>
        <span className={`etiqueta ${colorVence}`}>{textoVencimiento(item)}</span>
      </div>

      <div className={`aviso-minimo ${color}`}>
        <span className="aviso-minimo-linea" />
        <div>
          <div className="aviso-minimo-titulo">{mensaje}</div>
          <div className="aviso-minimo-nota">mín. {item.minimo} {item.unidad}{vencida ? ` · ${vencida} vencidos` : ''}</div>
        </div>
        <div className="aviso-minimo-cantidad">{item.cantidad} <span>{item.unidad}</span></div>
      </div>

      <div className="botones">
        <button className="btn btn-registrar btn-salida" data-accion="registrar" data-tipo="Salida" onClick={() => abrirMovimiento(categoria, item.id, 'Salida')}>
          <IconoSalida /> Registrar salida
        </button>
        <button className="btn btn-registrar btn-ingreso" data-accion="registrar" data-tipo="Ingreso" onClick={() => abrirMovimiento(categoria, item.id, 'Ingreso')}>
          <IconoIngreso /> Registrar ingreso
        </button>
      </div>
    </div>
  );
}
