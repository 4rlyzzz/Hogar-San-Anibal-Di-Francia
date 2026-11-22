"""python manage.py datos_prueba: carga los datos de prueba en una base vacia, sin errores."""
from collections import Counter
from datetime import date
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError

from api.management.commands import datos_prueba as dp

from .base import PruebaAPI


class DatosPruebaTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        # como una base recien preparada: solo el administrador creado con crear_usuario
        self.couch.base('usuario').pop(self.usuario['_id'])

    def cargar(self, *args):
        salida, errores = StringIO(), StringIO()
        call_command('datos_prueba', '--si', *args, stdout=salida, stderr=errores)
        return salida.getvalue(), errores.getvalue()

    def test_carga_todo_sin_errores(self):
        salida, errores = self.cargar()
        self.assertEqual(errores, '')
        self.assertIn('Datos de prueba cargados.', salida)

        productos = self.couch.todos('producto')
        por_categoria = Counter(p['categoria'] for p in productos)
        self.assertEqual(por_categoria, {'alimentos': len(dp.ALIMENTOS), 'salud': len(dp.SALUD), 'merchandising': len(dp.MERCH)})
        # mas de 15 por categoria: se ven las paginas del inventario
        self.assertGreater(len(dp.ALIMENTOS), 15)
        self.assertGreater(len(dp.SALUD), 15)

        self.assertEqual(len(self.couch.todos('donador')), len(dp.DONADORES))
        self.assertEqual(len(self.couch.todos('proveedor')), len(dp.PROVEEDORES))
        self.assertEqual(len(self.couch.todos('comprador')), len(dp.COMPRADORES))

        movs = self.couch.todos('movimiento')
        esperados = sum(len(m) for *_, m in dp.ALIMENTOS + dp.SALUD) + sum(len(m) for _, m in dp.MERCH)
        self.assertEqual(len(movs), esperados)
        self.assertEqual({m['tipo_movimiento'] for m in movs}, {'ingreso', 'salida', 'ajuste'})
        # los hace el equipo de prueba (cada uno en su area), repartidos en varias semanas
        self.assertEqual({m['responsable'] for m in movs}, {nombre for _, nombre, _, _ in dp.EQUIPO})
        salud = {m['responsable'] for m in movs if m['categoria'] == 'Salud' and m['tipo_movimiento'] == 'salida'}
        self.assertLessEqual(salud, {'Ruth', 'Revel'})
        self.assertGreater(len({m['creado'][:10] for m in movs}), 30)

        # el equipo quedo creado y puede entrar con la contraseña que se mostro
        usuarios = {u['usuario']: u for u in self.couch.todos('usuario')}
        self.assertLessEqual({u for u, *_ in dp.EQUIPO}, set(usuarios))
        self.assertEqual(usuarios['rosario']['rol'], 'Administrador')
        clave = salida.split('Contraseña de todos ellos: ')[1].split()[0]
        r = self.client.post('/api/auth/login/', {'usuario': 'cocina', 'clave': clave}, format='json')
        self.assertEqual(r.status_code, 200)
        # cada movimiento queda con el id de su cuenta (asi la pestaña Usuarios los cuenta)
        ids = {u['_id'] for u in usuarios.values()}
        self.assertTrue(all(m['usuario_id'] in ids for m in movs))

    def test_contrasena_elegida(self):
        salida, _ = self.cargar('--clave', 'equipo2026')
        self.assertNotIn('Contraseña de todos ellos', salida)
        r = self.client.post('/api/auth/login/', {'usuario': 'salud', 'clave': 'equipo2026'}, format='json')
        self.assertEqual(r.status_code, 200)
        with self.assertRaises(CommandError):
            call_command('datos_prueba', '--si', '--forzar', '--clave', 'corta', stdout=StringIO(), stderr=StringIO())

    def test_el_stock_cuadra_con_los_movimientos(self):
        self.cargar()
        for p in self.couch.todos('producto'):
            suma = 0
            for m in self.couch.todos('movimiento'):
                if m['producto_id'] != p['_id']:
                    continue
                suma += {'ingreso': m['cantidad'], 'salida': -m['cantidad'], 'ajuste': m.get('diferencia', 0)}[m['tipo_movimiento']]
            self.assertAlmostEqual(p['cantidad'], suma, msg=p['nombre'])
            self.assertGreaterEqual(p['cantidad'], 0, msg=p['nombre'])

    def test_quedan_casos_para_probar_las_alertas(self):
        self.cargar()
        productos = {p['nombre']: p for p in self.couch.todos('producto')}
        hoy = date.today().isoformat()
        # un lote vencido (para "Dar de baja")
        self.assertTrue(any(l['vence'] and l['vence'] < hoy and l['quedan'] > 0 for l in productos['Manzana']['lotes']))
        # bajo el minimo
        bajos = [p['nombre'] for p in productos.values() if p['cantidad'] < (p.get('stock_minimo') or 0)]
        self.assertGreaterEqual(len(bajos), 3, bajos)
        # ventas con comprador, medio de pago y comprobante
        ventas = [m for m in self.couch.todos('movimiento') if m['categoria'] == 'Merchandising' and m['tipo_movimiento'] == 'salida']
        self.assertTrue(all(m['total'] > 0 for m in ventas))
        self.assertTrue(any(m['comprobanteTipo'] == 'factura' for m in ventas))

    def test_no_duplica_y_no_carga_sobre_datos_reales(self):
        self.cargar()
        with self.assertRaises(CommandError):
            self.cargar()
        antes = len(self.couch.todos('movimiento'))
        salida, errores = self.cargar('--forzar')
        self.assertEqual(errores, '')
        self.assertEqual(len(self.couch.todos('movimiento')), antes)
        self.assertIn('ya existe, se salta', salida)

    def test_no_toca_la_cache(self):
        # en Railway corre como root: si dejara archivos en la cache, la app no podria leerlos
        with mock.patch('django.core.cache.cache.add') as add, mock.patch('django.core.cache.cache.set') as poner:
            self.cargar()
        self.assertEqual((add.call_count, poner.call_count), (0, 0))

    def test_pide_un_administrador(self):
        for c in self.couch.todos('usuario'):
            self.couch.base('usuario').pop(c['_id'])
        with self.assertRaises(CommandError):
            self.cargar()
