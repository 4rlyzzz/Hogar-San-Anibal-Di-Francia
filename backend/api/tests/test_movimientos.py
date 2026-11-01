from datetime import datetime, timedelta

from api.movimientos import ZONA

from .base import PruebaAPI

ARROZ = 'producto:alimentos:arroz'


def dias(n):
    """Fecha ISO de dentro de n dias (en hora de Peru, como el servidor)."""
    return (datetime.now(ZONA).date() + timedelta(days=n)).isoformat()


class MovimientoBase(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.entrar_como(self.usuario)

    def mover(self, tipo, producto_id=ARROZ, **datos):
        return self.client.post('/api/movimientos/', {'tipo': tipo, 'producto_id': producto_id, **datos}, format='json')

    def arroz(self):
        return self.couch.leer('producto', ARROZ)

    def movimientos(self):
        return self.couch.todos('movimiento')


class IngresoTests(MovimientoBase):
    def setUp(self):
        super().setUp()
        self.crear_producto('Arroz', unidad='kg')

    def test_ingreso_suma_stock_crea_lote_y_movimiento(self):
        r = self.mover('ingreso', cantidad=10.5, vence=dias(30), donador='Parroquia San José', actividad='Navidad')
        self.assertEqual(r.status_code, 201)
        arroz = self.arroz()
        self.assertEqual(arroz['cantidad'], 10.5)
        self.assertEqual(len(arroz['lotes']), 1)
        self.assertEqual(arroz['lotes'][0]['vence'], dias(30))

        [mov] = self.movimientos()
        self.assertEqual(mov['movimiento'], 'Ingreso')
        self.assertEqual(mov['cantidad'], 10.5)
        self.assertEqual(mov['saldo'], 10.5)
        self.assertEqual(mov['donador'], 'Parroquia San José')
        self.assertEqual(mov['actividad'], 'Navidad')
        self.assertEqual(mov['categoria'], 'Alimentos')
        # quien lo hizo sale del token
        self.assertEqual((mov['responsable'], mov['usuario_id']), ('Cocina', 'usuario:cocina'))

    def test_sin_donador_no_guarda_actividad(self):
        self.mover('ingreso', cantidad=1, actividad='Navidad')
        self.assertEqual(self.movimientos()[0]['actividad'], '')

    def test_guarda_el_codigo_de_barras_escaneado(self):
        self.mover('ingreso', cantidad=1, codigo_barras='7751271001234')
        self.mover('ingreso', cantidad=1, codigo_barras='7751271001234')
        self.assertEqual(self.arroz()['codigosBarras'], ['7751271001234'])

    def test_cantidades_invalidas(self):
        for mala in (0, -5, 'abc', 100001, 1.234):
            self.assertEqual(self.mover('ingreso', cantidad=mala).status_code, 400, mala)
        self.assertEqual(self.arroz()['cantidad'], 0)
        self.assertEqual(self.movimientos(), [])

    def test_unidades_enteras_no_aceptan_decimales(self):
        self.crear_producto('Leche', unidad='latas')
        r = self.mover('ingreso', 'producto:alimentos:leche', cantidad=2.5)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.mover('ingreso', 'producto:alimentos:leche', cantidad=3).status_code, 201)

    def test_fecha_de_vencimiento_pasada_o_invalida(self):
        self.assertEqual(self.mover('ingreso', cantidad=1, vence=dias(-1)).status_code, 400)
        self.assertEqual(self.mover('ingreso', cantidad=1, vence='2026-02-30').status_code, 400)
        self.assertEqual(self.mover('ingreso', cantidad=1, vence='mañana').status_code, 400)
        self.assertEqual(self.mover('ingreso', cantidad=1, vence=dias(0)).status_code, 201)

    def test_canal_desconocido_queda_manual(self):
        self.mover('ingreso', cantidad=1, canal='hackeado')
        self.mover('ingreso', cantidad=1, canal='voz')
        self.assertEqual(sorted(m['canal'] for m in self.movimientos()), ['manual', 'voz'])


class SalidaTests(MovimientoBase):
    def setUp(self):
        super().setUp()
        # 5 vencidos, 10 que vencen pronto, 20 sin fecha
        self.crear_producto('Arroz', cantidad=35, lotes=[
            self.lote(1, 20),
            self.lote(2, 10, vence=dias(5)),
            self.lote(3, 5, vence=dias(-2)),
        ])

    def quedan(self):
        return {l['id']: l['quedan'] for l in self.arroz()['lotes']}

    def test_salida_usa_primero_lo_que_vence_antes(self):
        r = self.mover('salida', cantidad=12, para=['Mateo', 'Lucía'])
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.arroz()['cantidad'], 23)
        # sale del que vence pronto, despues del sin fecha; el vencido no se toca
        self.assertEqual(self.quedan(), {1: 18, 2: 0, 3: 5})
        [mov] = self.movimientos()
        self.assertEqual(mov['para'], ['Mateo', 'Lucía'])
        self.assertEqual([(l['id'], l['cantidad']) for l in mov['lotes']], [(2, 10), (1, 2)])
        self.assertEqual(mov['saldo'], 23)

    def test_lo_vencido_no_cuenta_como_disponible(self):
        r = self.mover('salida', cantidad=31)
        self.assertEqual(r.status_code, 400)
        self.assertIn('Solo quedan 30', r.data['error'])
        self.assertIn('5 vencidos no cuentan', r.data['error'])
        # devuelve el producto real para que la pantalla se ponga al dia
        self.assertEqual(r.data['producto']['cantidad'], 35)
        self.assertEqual(self.arroz()['cantidad'], 35)
        self.assertEqual(self.movimientos(), [])

    def test_se_puede_sacar_todo_lo_disponible(self):
        self.assertEqual(self.mover('salida', cantidad=30).status_code, 201)
        self.assertEqual(self.arroz()['cantidad'], 5)

    def test_dos_salidas_seguidas_no_dejan_stock_negativo(self):
        self.assertEqual(self.mover('salida', cantidad=20).status_code, 201)
        self.assertEqual(self.mover('salida', cantidad=20).status_code, 400)
        self.assertEqual(self.arroz()['cantidad'], 15)

    def test_reintenta_si_otro_guardo_al_mismo_tiempo(self):
        self.couch.conflictos['casa_inventario'] = 3
        self.assertEqual(self.mover('salida', cantidad=1).status_code, 201)
        self.assertEqual(self.arroz()['cantidad'], 34)

    def test_demasiados_conflictos(self):
        self.couch.conflictos['casa_inventario'] = 100
        self.assertEqual(self.mover('salida', cantidad=1).status_code, 409)
        self.assertEqual(self.movimientos(), [])

    def test_si_no_se_guarda_el_movimiento_se_deshace_el_stock(self):
        antes = self.arroz()
        self.couch.fallas[('POST', 'casa_movimientos')] = 500
        r = self.mover('salida', cantidad=12)
        self.assertEqual(r.status_code, 502)
        despues = self.arroz()
        self.assertEqual(despues['cantidad'], antes['cantidad'])
        self.assertEqual(despues['lotes'], antes['lotes'])


class AjusteTests(MovimientoBase):
    def setUp(self):
        super().setUp()
        self.crear_producto('Arroz', cantidad=15, lotes=[self.lote(1, 10), self.lote(2, 5, vence=dias(-1))])

    def test_ajuste_faltante_descuenta_incluso_lo_vencido(self):
        r = self.mover('ajuste', contado=4, motivo='Producto malogrado o vencido', nota='Se mojó')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.arroz()['cantidad'], 4)
        [mov] = self.movimientos()
        self.assertEqual((mov['movimiento'], mov['diferencia'], mov['cantidad']), ('Ajuste', -11, 11))
        self.assertEqual(mov['nota'], 'Se mojó')

    def test_ajuste_sobrante_crea_un_lote(self):
        self.mover('ajuste', contado=18)
        arroz = self.arroz()
        self.assertEqual(arroz['cantidad'], 18)
        self.assertEqual(arroz['lotes'][-1]['origen'], 'Sobrante del conteo')
        self.assertEqual(arroz['lotes'][-1]['quedan'], 3)

    def test_ajuste_a_cero(self):
        self.assertEqual(self.mover('ajuste', contado=0).status_code, 201)
        self.assertEqual(self.arroz()['cantidad'], 0)

    def test_ajuste_sin_diferencia_se_rechaza(self):
        self.assertEqual(self.mover('ajuste', contado=15).status_code, 400)

    def test_motivo_por_defecto(self):
        self.mover('ajuste', contado=14)
        self.assertEqual(self.movimientos()[0]['motivo'], 'Sin identificar')


class BajaTests(MovimientoBase):
    def test_baja_saca_solo_lo_vencido(self):
        self.crear_producto('Arroz', cantidad=15, lotes=[self.lote(1, 10), self.lote(2, 5, vence=dias(-1))])
        r = self.mover('baja')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.arroz()['cantidad'], 10)
        [mov] = self.movimientos()
        self.assertEqual((mov['movimiento'], mov['cantidad'], mov['motivo']), ('Salida', 5, 'Baja por vencimiento'))

    def test_sin_nada_vencido(self):
        self.crear_producto('Arroz', cantidad=10, lotes=[self.lote(1, 10)])
        self.assertEqual(self.mover('baja').status_code, 400)


class MovimientoInvalidoTests(MovimientoBase):
    def test_tipo_desconocido(self):
        self.crear_producto('Arroz')
        self.assertEqual(self.mover('regalo', cantidad=1).status_code, 400)

    def test_producto_inexistente(self):
        self.assertEqual(self.mover('ingreso', 'producto:alimentos:nada', cantidad=1).status_code, 404)
        self.assertEqual(self.mover('ingreso', '', cantidad=1).status_code, 404)

    def test_producto_unido_a_otro(self):
        self.crear_producto('Arroz', unidoA='producto:alimentos:arroz-blanco')
        self.assertEqual(self.mover('ingreso', cantidad=1).status_code, 409)

    def test_requiere_sesion(self):
        self.salir()
        self.crear_producto('Arroz')
        self.assertEqual(self.mover('ingreso', cantidad=1).status_code, 401)


class HistorialTests(MovimientoBase):
    def test_historial_lista_los_movimientos(self):
        self.crear_producto('Arroz')
        self.mover('ingreso', cantidad=5)
        self.mover('salida', cantidad=2)
        r = self.client.get('/api/historial/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(sorted(m['movimiento'] for m in r.data), ['Ingreso', 'Salida'])

    def test_historial_es_solo_lectura(self):
        self.assertEqual(self.client.post('/api/historial/', {'movimiento': 'Ingreso'}, format='json').status_code, 405)


class UnirProductosTests(MovimientoBase):
    def setUp(self):
        super().setUp()
        self.entrar_como(self.admin)
        self.crear_producto('Arroz', cantidad=10, lotes=[self.lote(1, 10)])
        self.crear_producto('Arroz Blanco', cantidad=4, lotes=[self.lote(2, 4)], unidos=['Arroz Extra'])

    def unir(self, origen='producto:alimentos:arroz-blanco', destino=ARROZ):
        return self.client.post('/api/productos/unir/', {'origen_id': origen, 'destino_id': destino}, format='json')

    def test_une_stock_lotes_y_nombres(self):
        r = self.unir()
        self.assertEqual(r.status_code, 200)
        arroz = self.arroz()
        self.assertEqual(arroz['cantidad'], 14)
        self.assertEqual(sorted(l['id'] for l in arroz['lotes']), [1, 2])
        self.assertEqual(arroz['unidos'], ['Arroz Blanco', 'Arroz Extra'])
        self.assertIsNone(self.couch.leer('producto', 'producto:alimentos:arroz-blanco'))
        [mov] = self.movimientos()
        self.assertEqual((mov['movimiento'], mov['motivo'], mov['diferencia']), ('Ajuste', 'Unión de productos', 4))

    def test_solo_administradores(self):
        self.entrar_como(self.usuario)
        self.assertEqual(self.unir().status_code, 403)

    def test_presentacion_distinta(self):
        self.crear_producto('Arroz Saco', unidad='sacos')
        self.assertEqual(self.unir('producto:alimentos:arroz-saco').status_code, 400)
        self.assertEqual(self.arroz()['cantidad'], 10)

    def test_consigo_mismo(self):
        self.assertEqual(self.unir(ARROZ, ARROZ).status_code, 400)

    def test_si_no_se_puede_borrar_el_repetido_se_deshace_todo(self):
        self.couch.fallas[('DELETE', 'casa_inventario')] = 409
        self.assertEqual(self.unir().status_code, 409)
        arroz = self.arroz()
        self.assertEqual(arroz['cantidad'], 10)
        self.assertEqual([l['id'] for l in arroz['lotes']], [1])
        self.assertEqual(arroz.get('unidos', []), [])
        self.assertIsNotNone(self.couch.leer('producto', 'producto:alimentos:arroz-blanco'))
