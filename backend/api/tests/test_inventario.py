from .base import PruebaAPI


class CrearProductoTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.entrar_como(self.usuario)

    def crear(self, **datos):
        return self.client.post('/api/inventario/', {'nombre': 'Arroz', 'unidad': 'kg', 'stock_minimo': 10, **datos}, format='json')

    def test_crea_producto_sin_stock(self):
        r = self.crear(cantidad=500, lotes=[{'quedan': 500}])
        self.assertEqual(r.status_code, 201)
        doc = self.couch.leer('producto', 'producto:alimentos:arroz')
        # el stock nunca se pone al crear: entra con un ingreso
        self.assertEqual(doc['cantidad'], 0)
        self.assertEqual(doc['lotes'], [])
        self.assertEqual(doc['stock_minimo'], 10)

    def test_limpia_espacios_del_nombre(self):
        self.crear(nombre='  Leche   evaporada  ')
        self.assertIsNotNone(self.couch.leer('producto', 'producto:alimentos:leche-evaporada'))

    def test_categoria_salud(self):
        self.crear(nombre='Alcohol', categoria='Salud')
        self.assertEqual(self.couch.leer('producto', 'producto:salud:alcohol')['categoria'], 'salud')

    def test_nombre_obligatorio(self):
        self.assertEqual(self.crear(nombre='   ').status_code, 400)

    def test_minimo_invalido(self):
        for malo in (-1, 'abc', 100001, 'inf', 'nan'):
            self.assertEqual(self.crear(stock_minimo=malo).status_code, 400, malo)

    def test_no_repite_nombres_aunque_cambien_tildes_o_mayusculas(self):
        self.crear(nombre='Azúcar')
        r = self.crear(nombre='AZUCAR')
        self.assertEqual(r.status_code, 409)
        self.assertEqual(len(self.couch.todos('producto')), 1)

    def test_mismo_nombre_en_otra_categoria_si_se_puede(self):
        self.crear(nombre='Jabón')
        self.assertEqual(self.crear(nombre='Jabón', categoria='salud').status_code, 201)

    def test_lista_productos(self):
        self.crear(nombre='Arroz')
        self.crear(nombre='Fideos')
        r = self.client.get('/api/inventario/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(sorted(p['nombre'] for p in r.data), ['Arroz', 'Fideos'])


class EditarProductoTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.entrar_como(self.usuario)
        self.producto = self.crear_producto('Arroz', cantidad=20, lotes=[self.lote(1, 20)])

    def editar(self, datos, doc_id='producto:alimentos:arroz'):
        return self.client.put(f'/api/inventario/{doc_id}/', datos, format='json')

    def test_edita_campos_permitidos(self):
        r = self.editar({'stock_minimo': 8, 'almacen': 'Despensa'})
        self.assertEqual(r.status_code, 200)
        doc = self.couch.leer('producto', 'producto:alimentos:arroz')
        self.assertEqual((doc['stock_minimo'], doc['almacen']), (8, 'Despensa'))

    def test_no_se_puede_cambiar_el_stock_ni_el_tipo_editando(self):
        self.editar({'cantidad': 999, 'lotes': [], 'tipo': 'usuario', 'categoria': 'salud'})
        doc = self.couch.leer('producto', 'producto:alimentos:arroz')
        self.assertEqual(doc['cantidad'], 20)
        self.assertEqual(len(doc['lotes']), 1)
        self.assertEqual(doc['tipo'], 'producto')
        self.assertEqual(doc['categoria'], 'alimentos')

    def test_renombrar_a_un_nombre_que_ya_existe(self):
        self.crear_producto('Fideos')
        self.assertEqual(self.editar({'nombre': 'fideos'}).status_code, 409)

    def test_renombrar_a_su_mismo_nombre(self):
        self.assertEqual(self.editar({'nombre': 'ARROZ'}).status_code, 200)

    def test_minimo_invalido(self):
        self.assertEqual(self.editar({'stock_minimo': -3}).status_code, 400)

    def test_producto_inexistente(self):
        self.assertEqual(self.editar({'almacen': 'x'}, 'producto:alimentos:nada').status_code, 404)

    def test_id_de_otro_tipo_no_se_edita(self):
        self.assertEqual(self.editar({'nombre': 'x'}, 'usuario:admin').status_code, 404)

    def test_ids_reservados_de_couchdb(self):
        self.assertEqual(self.client.get('/api/inventario/_design/x/').status_code, 404)
        self.assertEqual(self.client.get('/api/inventario/_all_docs/').status_code, 400)

    def test_ver_un_producto(self):
        r = self.client.get('/api/inventario/producto:alimentos:arroz/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['nombre'], 'Arroz')


class EliminarProductoTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.producto = self.crear_producto('Arroz')

    def eliminar(self, rev):
        return self.client.delete(f'/api/inventario/producto:alimentos:arroz/?_rev={rev}')

    def test_solo_administradores(self):
        self.entrar_como(self.usuario)
        self.assertEqual(self.eliminar(self.producto['_rev']).status_code, 403)
        self.assertIsNotNone(self.couch.leer('producto', 'producto:alimentos:arroz'))

    def test_administrador_elimina(self):
        self.entrar_como(self.admin)
        self.assertEqual(self.eliminar(self.producto['_rev']).status_code, 200)
        self.assertIsNone(self.couch.leer('producto', 'producto:alimentos:arroz'))

    def test_con_version_vieja_no_elimina(self):
        self.entrar_como(self.admin)
        self.assertEqual(self.eliminar('1-viejo').status_code, 409)

    def test_sin_rev(self):
        self.entrar_como(self.admin)
        self.assertEqual(self.client.delete('/api/inventario/producto:alimentos:arroz/').status_code, 400)
