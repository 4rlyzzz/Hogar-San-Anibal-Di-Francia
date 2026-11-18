from api import merch

from .base import PruebaAPI
from .test_movimientos import dias

PANETON = {
    'categoria': 'merchandising', 'tipoMerch': 'paneton', 'nombre': 'Panetón Clásico', 'marca': "D'Onofrio",
    'presentacion': 'caja 900 g', 'precio': 25, 'stock_minimo': 6, 'descuentoDesde': 6, 'precioDescuento': 22,
}
ROSARIO = {
    'categoria': 'merchandising', 'tipoMerch': 'hogar', 'subcategoria': 'general', 'nombre': 'Rosario de madera',
    'articulo': 'rosario', 'variante': 'marrón', 'unidad': 'unidades', 'precio': 8, 'stock_minimo': 3,
}
MERMELADA = {
    'categoria': 'merchandising', 'tipoMerch': 'hogar', 'subcategoria': 'alimentos', 'nombre': 'Mermelada de fresa',
    'presentacion': 'frasco 300 ml', 'perecible': True, 'unidad': 'unidades', 'precio': 12, 'stock_minimo': 2,
}
POLO = {
    'categoria': 'merchandising', 'tipoMerch': 'promocional', 'subcategoria': 'prendas', 'nombre': 'Polo Hogar',
    'articulo': 'polo', 'talla': 'M', 'color': 'Azul', 'unidad': 'unidades', 'precio': 30, 'stock_minimo': 5,
}


class MerchBase(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.entrar_como(self.usuario)

    def crear(self, datos, **cambios):
        return self.client.post('/api/inventario/', {**datos, **cambios}, format='json')

    def crear_id(self, datos, **cambios):
        r = self.crear(datos, **cambios)
        self.assertEqual(r.status_code, 201, r.data)
        return r.data['id']

    def mover(self, tipo, producto_id, **datos):
        return self.client.post('/api/movimientos/', {'tipo': tipo, 'producto_id': producto_id, **datos}, format='json')


class ProductoMerchTests(MerchBase):
    def test_paneton_con_su_nombre_completo(self):
        doc_id = self.crear_id(PANETON)
        doc = self.couch.leer('producto', doc_id)
        self.assertEqual(doc_id, "producto:merchandising:paneton-clasico-d-onofrio-caja-900-g")
        self.assertEqual(doc['nombre'], "Panetón Clásico D'Onofrio caja 900 g")
        self.assertEqual((doc['categoria'], doc['unidad'], doc['cantidad']), ('merchandising', 'unidades', 0))
        self.assertEqual((doc['precio'], doc['descuentoDesde'], doc['precioDescuento']), (25, 6, 22))

    def test_la_marca_no_se_repite_si_ya_esta_en_el_nombre(self):
        doc_id = self.crear_id(PANETON, nombre="Panetón D'Onofrio")
        self.assertEqual(self.couch.leer('producto', doc_id)['nombre'], "Panetón D'Onofrio caja 900 g")

    def test_cada_talla_y_color_es_otro_producto(self):
        self.crear_id(POLO)
        self.crear_id(POLO, talla='L')
        self.crear_id(POLO, color='Rojo')
        self.assertEqual(self.crear(POLO, color='azul').status_code, 409)
        nombres = sorted(p['nombre'] for p in self.couch.todos('producto'))
        self.assertEqual(nombres, ['Polo Hogar talla L Azul', 'Polo Hogar talla M Azul', 'Polo Hogar talla M Rojo'])

    def test_campos_obligatorios_segun_el_tipo(self):
        casos = [
            (PANETON, {'marca': ''}, 'marca'),
            (PANETON, {'presentacion': ' '}, 'presentación'),
            (PANETON, {'precio': 0}, 'precio'),
            (PANETON, {'precioDescuento': None}, 'precio con descuento'),
            (PANETON, {'precioDescuento': 30}, 'menor'),
            (PANETON, {'descuentoDesde': 1.5}, 'entero'),
            (ROSARIO, {'articulo': 'cuadro'}, 'artículo'),
            (ROSARIO, {'unidad': 'kg'}, 'unidad'),
            (ROSARIO, {'subcategoria': 'prendas'}, 'subcategoría'),
            (MERMELADA, {'perecible': 'si'}, 'perecible'),
            (POLO, {'talla': 'XXXL'}, 'talla'),
            (POLO, {'color': ''}, 'color'),
            (POLO, {'tipoMerch': 'otro'}, 'tipo'),
        ]
        for datos, cambio, texto in casos:
            with self.subTest(cambio=cambio):
                r = self.crear(datos, **cambio)
                self.assertEqual(r.status_code, 400)
                self.assertIn(texto, r.data['error'])
        self.assertEqual(self.couch.todos('producto'), [])

    def test_no_se_mezcla_con_otras_categorias(self):
        self.crear_producto("Panetón Clásico D'Onofrio caja 900 g", categoria='alimentos', unidad='unidades')
        self.assertEqual(self.crear(PANETON).status_code, 201)

    def test_nombre_demasiado_largo(self):
        r = self.crear(POLO, nombre='Polo conmemorativo del aniversario número cincuenta')
        self.assertEqual(r.status_code, 400)
        self.assertIn('muy largo', r.data['error'])

    def test_editar_precio_y_descuento(self):
        doc_id = self.crear_id(PANETON)
        r = self.client.put(f'/api/inventario/{doc_id}/', {'precio': 28, 'precioDescuento': 24}, format='json')
        self.assertEqual(r.status_code, 200)
        doc = self.couch.leer('producto', doc_id)
        self.assertEqual((doc['precio'], doc['precioDescuento']), (28, 24))
        r = self.client.put(f'/api/inventario/{doc_id}/', {'precio': 20}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.couch.leer('producto', doc_id)['precio'], 28)

    def test_editar_no_cambia_el_stock_ni_el_tipo(self):
        doc_id = self.crear_id(POLO)
        self.client.put(f'/api/inventario/{doc_id}/', {'cantidad': 99, 'tipoMerch': 'paneton', 'talla': 'S', 'precio': 35}, format='json')
        doc = self.couch.leer('producto', doc_id)
        self.assertEqual((doc['cantidad'], doc['tipoMerch'], doc['talla'], doc['precio']), (0, 'promocional', 'M', 35))

    def test_los_demas_productos_ignoran_los_campos_de_merch(self):
        self.crear_producto('Arroz')
        r = self.client.put('/api/inventario/producto:alimentos:arroz/', {'precio': 10}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertNotIn('precio', self.couch.leer('producto', 'producto:alimentos:arroz'))


class IngresoMerchTests(MerchBase):
    def test_paneton_pide_fecha_costo_y_guarda_comprobante(self):
        doc_id = self.crear_id(PANETON)
        self.assertIn('vencimiento', self.mover('ingreso', doc_id, cantidad=10, costo_unitario=18).data['error'])
        self.assertIn('costo', self.mover('ingreso', doc_id, cantidad=10, vence=dias(60)).data['error'])
        r = self.mover('ingreso', doc_id, cantidad=10, vence=dias(60), costo_unitario=18.5, proveedor='distribuidora lima',
                       comprobante_tipo='factura', comprobante_numero='F001-123', lote_codigo='L-2026', donador='Alguien')
        self.assertEqual(r.status_code, 201, r.data)
        mov = r.data['movimiento']
        self.assertEqual(mov['categoria'], 'Merchandising')
        self.assertEqual((mov['tipoMerch'], mov['subcategoria']), ('paneton', None))
        self.assertEqual((mov['proveedor'], mov['costoUnitario'], mov['costoTotal']), ('Distribuidora Lima', 18.5, 185))
        self.assertEqual((mov['comprobanteTipo'], mov['comprobanteNumero'], mov['loteCodigo']), ('factura', 'F001-123', 'L-2026'))
        self.assertEqual(mov['donador'], '')
        producto = self.couch.leer('producto', doc_id)
        self.assertEqual(producto['cantidad'], 10)
        self.assertEqual(producto['lotes'][0]['codigo'], 'L-2026')

    def test_promocional_pide_proveedor_y_no_vence(self):
        doc_id = self.crear_id(POLO)
        self.assertIn('proveedor', self.mover('ingreso', doc_id, cantidad=5, costo_unitario=15).data['error'])
        r = self.mover('ingreso', doc_id, cantidad=5, costo_unitario=15, proveedor='Textiles Sur', vence=dias(30))
        self.assertEqual(r.status_code, 201)
        self.assertIsNone(r.data['movimiento']['vence'])

    def test_hecho_en_el_hogar_sin_proveedor_ni_costo(self):
        doc_id = self.crear_id(ROSARIO)
        r = self.mover('ingreso', doc_id, cantidad=12, taller='Taller de manualidades', proveedor='No va', costo_materiales=0)
        self.assertEqual(r.status_code, 201, r.data)
        mov = r.data['movimiento']
        self.assertEqual((mov['taller'], mov['proveedor'], mov['costoMateriales']), ('Taller de manualidades', '', 0))
        self.assertEqual((mov['tipoMerch'], mov['subcategoria']), ('hogar', 'general'))
        r = self.mover('ajuste', doc_id, contado=10, motivo='Se rompió o dañó')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['movimiento']['tipoMerch'], 'hogar')

    def test_alimento_perecible_del_hogar_pide_fecha(self):
        doc_id = self.crear_id(MERMELADA)
        self.assertEqual(self.mover('ingreso', doc_id, cantidad=4).status_code, 400)
        no_perecible = self.crear_id(MERMELADA, nombre='Galletas', perecible=False)
        self.assertEqual(self.mover('ingreso', no_perecible, cantidad=4).status_code, 201)

    def test_datos_invalidos(self):
        doc_id = self.crear_id(POLO)
        for datos in ({'costo_unitario': -1}, {'costo_unitario': 'diez'}, {'costo_unitario': 1.234},
                      {'comprobante_tipo': 'recibo'}, {'comprobante_numero': 'F001 <script>'}):
            with self.subTest(datos=datos):
                r = self.mover('ingreso', doc_id, cantidad=1, proveedor='Textiles Sur', **{'costo_unitario': 10, **datos})
                self.assertEqual(r.status_code, 400)
        self.assertEqual(self.couch.leer('producto', doc_id)['cantidad'], 0)
        self.assertEqual(self.couch.todos('movimiento'), [])


class SalidaMerchTests(MerchBase):
    def setUp(self):
        super().setUp()
        self.paneton = self.crear_id(PANETON)
        self.mover('ingreso', self.paneton, cantidad=20, vence=dias(60), costo_unitario=18)

    def test_precio_con_descuento_desde_la_cantidad_minima(self):
        r = self.mover('salida', self.paneton, cantidad=2)
        self.assertEqual((r.data['movimiento']['precioUnitario'], r.data['movimiento']['total']), (25, 50))
        r = self.mover('salida', self.paneton, cantidad=6)
        self.assertEqual((r.data['movimiento']['precioUnitario'], r.data['movimiento']['total']), (22, 132))
        self.assertEqual(self.couch.leer('producto', self.paneton)['cantidad'], 12)

    def test_precio_editado_comprador_y_medio_de_pago(self):
        r = self.mover('salida', self.paneton, cantidad=3, precio_unitario=20, comprador='rosa quispe', medio_pago='yape-plin',
                       comprobante_tipo='boleta', para=['Mateo'])
        self.assertEqual(r.status_code, 201)
        mov = r.data['movimiento']
        self.assertEqual((mov['comprador'], mov['precioUnitario'], mov['total'], mov['medioPago']), ('Rosa Quispe', 20, 60, 'yape-plin'))
        self.assertEqual(mov['para'], [])

    def test_puede_regalarse_pero_no_precio_negativo(self):
        self.assertEqual(self.mover('salida', self.paneton, cantidad=1, precio_unitario=0).status_code, 201)
        self.assertEqual(self.mover('salida', self.paneton, cantidad=1, precio_unitario=-5).status_code, 400)
        self.assertEqual(self.mover('salida', self.paneton, cantidad=1, medio_pago='tarjeta').status_code, 400)

    def test_no_saca_mas_de_lo_que_hay(self):
        r = self.mover('salida', self.paneton, cantidad=21)
        self.assertEqual(r.status_code, 400)
        self.assertIn('Solo quedan 20', r.data['error'])

    def test_unir_solo_la_misma_talla(self):
        self.entrar_como(self.admin)
        m = self.crear_id(POLO)
        l = self.crear_id(POLO, talla='L')
        r = self.client.post('/api/productos/unir/', {'origen_id': m, 'destino_id': l}, format='json')
        self.assertEqual(r.status_code, 400)


class PrecioSugeridoTests(PruebaAPI):
    def test_sin_descuento(self):
        self.assertEqual(merch.precio_sugerido({'precio': 30}, 50), 30)

    def test_con_descuento(self):
        producto = {'precio': 25, 'descuentoDesde': 6, 'precioDescuento': 22}
        self.assertEqual(merch.precio_sugerido(producto, 5), 25)
        self.assertEqual(merch.precio_sugerido(producto, 6), 22)


class PersonasMerchTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.entrar_como(self.usuario)

    def test_proveedor_pide_telefono_y_ruc_valido(self):
        self.assertEqual(self.client.post('/api/proveedores/', {'nombre': 'Textiles Sur'}, format='json').status_code, 400)
        r = self.client.post('/api/proveedores/', {'nombre': 'Textiles Sur', 'telefono': '987 654 321', 'ruc': '123'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/proveedores/', {'nombre': 'textiles sur', 'telefono': '987 654 321', 'ruc': '20123456789',
                                                   'creadoPor': 'Otro'}, format='json')
        self.assertEqual(r.status_code, 201)
        doc = self.couch.leer('proveedor', 'proveedor:textiles-sur')
        self.assertEqual((doc['nombre'], doc['ruc'], doc['creadoPor']), ('Textiles Sur', '20123456789', 'Cocina'))
        self.assertEqual(self.client.post('/api/proveedores/', {'nombre': 'TEXTILES SUR', 'telefono': '987654321'}, format='json').status_code, 409)

    def test_comprador_sin_telefono(self):
        r = self.client.post('/api/compradores/', {'nombre': 'rosa quispe'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.post('/api/compradores/', {'nombre': 'Ana', 'telefono': 'abc'}, format='json').status_code, 400)
        r = self.client.get('/api/compradores/')
        self.assertEqual([c['nombre'] for c in r.data], ['Rosa Quispe'])

    def test_sin_sesion_no_entra(self):
        self.salir()
        self.assertEqual(self.client.get('/api/proveedores/').status_code, 401)
        self.assertEqual(self.client.post('/api/compradores/', {'nombre': 'X'}, format='json').status_code, 401)

    def test_sin_la_base_todavia(self):
        del self.couch.bases['casa_proveedores']
        self.assertEqual(self.client.get('/api/proveedores/').data, [])
        r = self.client.post('/api/proveedores/', {'nombre': 'Textiles Sur', 'telefono': '987654321'}, format='json')
        self.assertEqual(r.status_code, 503)
        self.assertIn('setup_couch', r.data['error'])
