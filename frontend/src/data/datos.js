// datos de prueba mientras no hay backend

export const usuario = { nombre: 'Rosa Ticona', iniciales: 'RT', rol: 'Usuario' };

export const alimentos = [
  { id: 1, codigo: 'LE', nombre: 'Leche evaporada', cantidad: 96, maximo: 133, unidad: 'latas', vence: 'Fresco', color: 'verde', porVencer: false },
  { id: 2, codigo: 'FR', nombre: 'Manzana delicia', cantidad: 42, maximo: 110, unidad: 'kg', vence: '5 días', color: 'naranja', porVencer: true },
  { id: 3, codigo: 'AV', nombre: 'Avena Arequipeña', cantidad: 150, maximo: 160, unidad: 'kg', vence: '8 días', color: 'naranja', porVencer: true, lote: 'AV-3308', diasParaVencer: 8, consumoDiario: 3.75 },
  { id: 4, codigo: 'AR', nombre: 'Arroz extra', cantidad: 210, maximo: 330, unidad: 'kg', vence: 'Fresco', color: 'verde', porVencer: false },
  { id: 5, codigo: 'PO', nombre: 'Pollo congelado', cantidad: 28, maximo: 150, unidad: 'kg', vence: '2 días', color: 'rojo', porVencer: true },
  { id: 6, codigo: 'LT', nombre: 'Lenteja serrana', cantidad: 12, maximo: 55, unidad: 'kg', vence: 'Fresco', color: 'verde', porVencer: false },
];

export const salud = [
  { id: 1, codigo: 'JB', nombre: 'Jarabe paracetamol', lote: 'PX-4471', cantidad: 18, minimo: 10, unidad: 'frascos', vence: 'Vence 02/27', color: 'verde', porVencer: false },
  { id: 2, codigo: 'PA', nombre: 'Amoxicilina 500 mg', lote: 'AM-2290', cantidad: 6, minimo: 12, unidad: 'blísters', vence: 'Vence 11/26', color: 'naranja', porVencer: false },
  { id: 3, codigo: 'PÑ', nombre: 'Pañales talla M', lote: 'DN-0815', cantidad: 4, minimo: 10, unidad: 'paquetes', vence: 'Sin vencimiento', color: 'azul', porVencer: false },
  { id: 4, codigo: 'SR', nombre: 'Suero oral', lote: 'SO-1132', cantidad: 34, minimo: 20, unidad: 'sobres', vence: 'Vence 06/27', color: 'verde', porVencer: false },
  { id: 5, codigo: 'AG', nombre: 'Alcohol en gel', lote: 'AG-7740', cantidad: 22, minimo: 8, unidad: 'L', vence: 'Vence 03/27', color: 'verde', porVencer: false },
  { id: 6, codigo: 'VT', nombre: 'Vitamina C pediátrica', lote: 'VC-5503', cantidad: 9, minimo: 8, unidad: 'frascos', vence: '28 días', color: 'naranja', porVencer: true },
];

export const historial = [
  { fecha: '11 set 09:05', insumo: 'Avena Arequipeña', categoria: 'Alimentos', movimiento: 'Ingreso', cantidad: '+150 kg', responsable: 'María Quispe' },
  { fecha: '11 set 08:40', insumo: 'Leche evaporada', categoria: 'Alimentos', movimiento: 'Salida', cantidad: '−12 latas', responsable: 'Cocina · Rosa T.' },
  { fecha: '10 set 18:22', insumo: 'Amoxicilina 500 mg', categoria: 'Salud', movimiento: 'Salida', cantidad: '−2 blísters', responsable: 'Enfermería · Luis R.' },
  { fecha: '10 set 16:10', insumo: 'Pañales talla M', categoria: 'Salud', movimiento: 'Salida', cantidad: '−3 paquetes', responsable: 'Cuidado · Ana P.' },
  { fecha: '10 set 11:35', insumo: 'Pollo congelado', categoria: 'Alimentos', movimiento: 'Salida', cantidad: '−8 kg', responsable: 'Cocina · Rosa T.' },
  { fecha: '09 set 15:48', insumo: 'Suero oral', categoria: 'Salud', movimiento: 'Ingreso', cantidad: '+40 sobres', responsable: 'Donación · Red Hogares' },
  { fecha: '09 set 09:12', insumo: 'Arroz extra', categoria: 'Alimentos', movimiento: 'Ingreso', cantidad: '+120 kg', responsable: 'María Quispe' },
];
