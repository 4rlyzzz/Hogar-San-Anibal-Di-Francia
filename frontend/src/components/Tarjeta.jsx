import { IconoSalida, IconoIngreso } from '../assets/iconos.jsx';
import { verProducto, abrirMovimiento } from '../acciones.js';
import { colorVencimiento, textoVencimiento, textoPresentacion, disponible, cantidadVencida } from '../logica/comunes.js';
import { esMerch, textoMerch, textoTipo, textoPrecio, puedeVence } from '../logica/merch.js';

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
  const merch = esMerch(categoria);
  const etiqueta = merch && !puedeVence(item) ? { color: 'morado', texto: textoTipo(item).split(' · ')[0] } : { color: colorVence, texto: textoVencimiento(item) };

  return (
    <div className="tarjeta">
      <div className="tarjeta-top">
        <div className={`tarjeta-codigo ${merch && !puedeVence(item) ? 'morado' : colorVence}`}>{item.codigo}</div>
        <div className="tarjeta-info">
          <span className="tarjeta-nombre">{item.nombre}</span>
          {/* siempre se ve en que viene: 'Bolsa x 1 kg' o 'Suelto, en sacos'; en merchandising, marca, talla... y el precio */}
          <span className="tarjeta-descripcion">{merch ? textoMerch(item) || textoTipo(item) : textoPresentacion(item) || `Suelto, en ${item.unidad}`}</span>
          {merch && <span className="tarjeta-precio">{textoPrecio(item)}</span>}
          <button className="tarjeta-ver" data-accion="ver-producto" onClick={() => verProducto(categoria, item.id)}>Ver detalle ›</button>
        </div>
        <span className={`etiqueta ${etiqueta.color}`}>{etiqueta.texto}</span>
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
          <IconoSalida /> {merch ? 'Registrar venta' : 'Registrar salida'}
        </button>
        <button className="btn btn-registrar btn-ingreso" data-accion="registrar" data-tipo="Ingreso" onClick={() => abrirMovimiento(categoria, item.id, 'Ingreso')}>
          <IconoIngreso /> Registrar ingreso
        </button>
      </div>
    </div>
  );
}
