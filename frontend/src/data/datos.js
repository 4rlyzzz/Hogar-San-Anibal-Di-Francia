// datos de prueba mientras no hay backend

export const usuario = { nombre: 'Almacén', iniciales: 'AL', rol: 'Usuario' };

// otra tabla aparte: los donadores se ingresan a mano (pestaña Donadores o al registrar un ingreso)
export const donadores = [];

// productos perecibles
export const alimentos = [
  { id: 1, codigo: 'LE', nombre: 'Leche evaporada Gloria', descripcion: 'Lata de 400 g, para el desayuno', cantidad: 96, minimo: 40, unidad: 'latas', vencimiento: '2027-03-15', lote: '' },
  { id: 2, codigo: 'MA', nombre: 'Manzana', descripcion: 'Fruta para el refrigerio', cantidad: 42, minimo: 30, unidad: 'kg', vencimiento: '2026-10-13', lote: '' },
  { id: 3, codigo: 'AV', nombre: 'Avena 3 Ositos', descripcion: 'Bolsa de 1 kg, para el desayuno', cantidad: 150, minimo: 50, unidad: 'kg', vencimiento: '2026-10-16', lote: 'AV-3308', consumoDiario: 3.75 },
  { id: 4, codigo: 'AR', nombre: 'Arroz Costeño', descripcion: 'Saco de 50 kg', cantidad: 210, minimo: 100, unidad: 'kg', vencimiento: '2027-08-20', lote: '' },
  { id: 5, codigo: 'PO', nombre: 'Pollo entero', descripcion: 'Congelado, para el almuerzo', cantidad: 28, minimo: 40, unidad: 'kg', vencimiento: '2026-10-10', lote: '' },
  { id: 6, codigo: 'LT', nombre: 'Lentejas', descripcion: 'Bolsa de 1 kg', cantidad: 12, minimo: 20, unidad: 'kg', vencimiento: '2027-05-10', lote: '' },
];

// productos indispensables (medicinas e higiene)
// paraNino: si la medicina es para un niño en especifico
export const salud = [
  { id: 1, codigo: 'PC', nombre: 'Paracetamol jarabe 120 mg/5 ml', descripcion: 'Para fiebre y dolor', cantidad: 18, minimo: 10, unidad: 'frascos', vencimiento: '2027-02-28', lote: 'PX-4471', paraNino: '' },
  { id: 2, codigo: 'AM', nombre: 'Amoxicilina 500 mg', descripcion: 'Antibiótico, solo con receta', cantidad: 6, minimo: 12, unidad: 'blísters', vencimiento: '2026-11-30', lote: 'AM-2290', paraNino: '' },
  { id: 3, codigo: 'PÑ', nombre: 'Pañales Huggies talla M', descripcion: 'Paquete de 40 unidades', cantidad: 4, minimo: 10, unidad: 'paquetes', vencimiento: null, lote: 'DN-0815', paraNino: '' },
  { id: 4, codigo: 'SR', nombre: 'Sales de rehidratación oral', descripcion: 'Para deshidratación por diarrea', cantidad: 34, minimo: 20, unidad: 'sobres', vencimiento: '2027-06-30', lote: 'SO-1132', paraNino: '' },
  { id: 5, codigo: 'AG', nombre: 'Alcohol en gel', descripcion: 'Frasco de 1 L', cantidad: 22, minimo: 8, unidad: 'L', vencimiento: '2027-03-31', lote: 'AG-7740', paraNino: '' },
  { id: 6, codigo: 'VC', nombre: 'Vitamina C gotas', descripcion: 'Suplemento para niños', cantidad: 9, minimo: 8, unidad: 'frascos', vencimiento: '2026-11-05', lote: 'VC-5503', paraNino: '' },
];

// movimientos: ingresos y salidas de cada producto
export const historial = [
  { fecha: '07 oct 09:05', insumo: 'Avena 3 Ositos', categoria: 'Alimentos', movimiento: 'Ingreso', cantidad: 150, unidad: 'kg', responsable: 'Almacén', donador: '', para: '' },
  { fecha: '07 oct 08:40', insumo: 'Leche evaporada Gloria', categoria: 'Alimentos', movimiento: 'Salida', cantidad: 12, unidad: 'latas', responsable: 'Cocina', donador: '', para: '' },
  { fecha: '06 oct 18:22', insumo: 'Amoxicilina 500 mg', categoria: 'Salud', movimiento: 'Salida', cantidad: 2, unidad: 'blísters', responsable: 'Enfermería', donador: '', para: '' },
  { fecha: '06 oct 16:10', insumo: 'Pañales Huggies talla M', categoria: 'Salud', movimiento: 'Salida', cantidad: 3, unidad: 'paquetes', responsable: 'Cuidado', donador: '', para: '' },
  { fecha: '06 oct 11:35', insumo: 'Pollo entero', categoria: 'Alimentos', movimiento: 'Salida', cantidad: 8, unidad: 'kg', responsable: 'Cocina', donador: '', para: '' },
  { fecha: '05 oct 15:48', insumo: 'Sales de rehidratación oral', categoria: 'Salud', movimiento: 'Ingreso', cantidad: 40, unidad: 'sobres', responsable: 'Almacén', donador: '', para: '' },
  { fecha: '05 oct 09:12', insumo: 'Arroz Costeño', categoria: 'Alimentos', movimiento: 'Ingreso', cantidad: 120, unidad: 'kg', responsable: 'Almacén', donador: '', para: '' },
];
