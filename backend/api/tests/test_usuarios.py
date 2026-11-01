from api.views import principal_id

from .base import CLAVE, PruebaAPI


class ListarUsuariosTests(PruebaAPI):
    def test_solo_administradores(self):
        self.entrar_como(self.usuario)
        self.assertEqual(self.client.get('/api/usuarios/').status_code, 403)
        self.assertEqual(self.client.post('/api/usuarios/', {}, format='json').status_code, 403)
        self.assertEqual(self.client.put('/api/usuarios/usuario:cocina/', {}, format='json').status_code, 403)

    def test_lista_sin_contrasenas_y_marca_la_principal(self):
        self.entrar_como(self.admin)
        r = self.client.get('/api/usuarios/')
        self.assertEqual(r.status_code, 200)
        for u in r.data:
            self.assertNotIn('clave', u)
            self.assertNotIn('password', u)
        principal = {u['usuario']: u['principal'] for u in r.data}
        self.assertEqual(principal, {'admin': True, 'cocina': False})

    def test_ninguna_ruta_devuelve_contrasenas(self):
        self.entrar_como(self.admin)
        r = self.client.get('/api/auth/yo/')
        self.assertNotIn('clave', r.data)
        r = self.client.put('/api/usuarios/usuario:cocina/', {'nombre': 'Cocina 2'}, format='json')
        self.assertNotIn('clave', r.data)


class PrincipalTests(PruebaAPI):
    def test_la_marcada(self):
        self.assertEqual(principal_id([{'_id': 'a', 'rol': 'Administrador'}, {'_id': 'b', 'principal': True}]), 'b')

    def test_sin_marca_el_admin_mas_antiguo(self):
        usuarios = [
            {'_id': 'nuevo', 'rol': 'Administrador', 'creado': '2026-05-01'},
            {'_id': 'viejo', 'rol': 'Administrador', 'creado': '2025-01-01'},
            {'_id': 'usuario', 'rol': 'Usuario', 'creado': '2020-01-01'},
        ]
        self.assertEqual(principal_id(usuarios), 'viejo')

    def test_sin_administradores(self):
        self.assertIsNone(principal_id([{'_id': 'a', 'rol': 'Usuario'}]))


class CrearUsuarioTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.entrar_como(self.admin)

    def crear(self, **datos):
        return self.client.post('/api/usuarios/', {'usuario': 'lavanderia', 'nombre': 'Lavandería', 'clave': 'lava12345', **datos}, format='json')

    def test_crea_usuario_con_clave_cifrada(self):
        r = self.crear()
        self.assertEqual(r.status_code, 201)
        doc = self.couch.leer('usuario', 'usuario:lavanderia')
        self.assertEqual((doc['rol'], doc['activo']), ('Usuario', True))
        self.assertNotEqual(doc['clave'], 'lava12345')
        self.assertEqual((doc['creadoPor'], doc['creadoPorId']), ('Dirección', 'usuario:admin'))

    def test_el_nuevo_usuario_puede_entrar(self):
        self.crear()
        self.salir()
        r = self.client.post('/api/auth/login/', {'usuario': 'lavanderia', 'clave': 'lava12345'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_no_acepta_campos_extra(self):
        self.crear(activo=False, principal=True, cambios=[1])
        doc = self.couch.leer('usuario', 'usuario:lavanderia')
        self.assertTrue(doc['activo'])
        self.assertNotIn('principal', doc)
        self.assertNotIn('cambios', doc)

    def test_rol_invalido(self):
        self.assertEqual(self.crear(rol='SuperAdmin').status_code, 400)

    def test_faltan_datos_o_clave_debil(self):
        self.assertEqual(self.crear(usuario='').status_code, 400)
        self.assertEqual(self.crear(clave='').status_code, 400)
        self.assertEqual(self.crear(clave='corta1').status_code, 400)
        self.assertEqual(self.crear(clave='sinnumeros').status_code, 400)

    def test_usuario_repetido(self):
        self.assertEqual(self.crear(usuario='COCINA').status_code, 409)


class EditarUsuarioTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.entrar_como(self.admin)

    def editar(self, doc_id, **datos):
        return self.client.put(f'/api/usuarios/{doc_id}/', datos, format='json')

    def test_cambiar_rol_queda_registrado(self):
        r = self.editar('usuario:cocina', rol='Administrador')
        self.assertEqual(r.status_code, 200)
        doc = self.couch.leer('usuario', 'usuario:cocina')
        self.assertEqual(doc['rol'], 'Administrador')
        [cambio] = doc['cambios']
        self.assertEqual((cambio['accion'], cambio['valor'], cambio['quienId']), ('rol', 'Administrador', 'usuario:admin'))

    def test_el_cambio_de_rol_se_nota_al_instante(self):
        self.entrar_como(self.usuario)
        self.client.get('/api/inventario/')  # queda en cache como Usuario
        self.entrar_como(self.admin)
        self.editar('usuario:cocina', rol='Administrador')
        self.entrar_como(self.usuario)
        self.assertEqual(self.client.get('/api/usuarios/').status_code, 200)

    def test_desactivar_corta_el_acceso(self):
        self.editar('usuario:cocina', activo=False)
        self.entrar_como(self.usuario)
        self.assertEqual(self.client.get('/api/inventario/').status_code, 401)

    def test_activo_debe_ser_booleano(self):
        self.assertEqual(self.editar('usuario:cocina', activo='no').status_code, 400)

    def test_restablecer_clave(self):
        self.assertEqual(self.editar('usuario:cocina', clave='otra12345').status_code, 200)
        self.assertEqual(self.couch.leer('usuario', 'usuario:cocina')['cambios'][0]['accion'], 'clave')
        self.salir()
        r = self.client.post('/api/auth/login/', {'usuario': 'cocina', 'clave': 'otra12345'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_sin_clave_nueva_se_conserva_la_actual(self):
        antes = self.couch.leer('usuario', 'usuario:cocina')['clave']
        self.editar('usuario:cocina', nombre='Cocina Central')
        self.assertEqual(self.couch.leer('usuario', 'usuario:cocina')['clave'], antes)

    def test_clave_debil(self):
        self.assertEqual(self.editar('usuario:cocina', clave='123').status_code, 400)

    def test_la_cuenta_principal_no_se_modifica(self):
        otro = self.crear_usuario('director2', 'Administrador')
        self.entrar_como(otro)
        self.assertEqual(self.editar('usuario:admin', rol='Usuario').status_code, 403)
        self.assertEqual(self.editar('usuario:admin', activo=False).status_code, 403)
        self.assertEqual(self.editar('usuario:admin', clave='otra12345').status_code, 403)
        self.assertEqual(self.couch.leer('usuario', 'usuario:admin')['rol'], 'Administrador')

    def test_no_puede_quitarse_el_rol_ni_desactivarse(self):
        otro = self.crear_usuario('director2', 'Administrador')
        self.entrar_como(otro)
        self.assertEqual(self.editar('usuario:director2', rol='Usuario').status_code, 400)
        self.assertEqual(self.editar('usuario:director2', activo=False).status_code, 400)

    def test_usuario_inexistente(self):
        self.assertEqual(self.editar('usuario:nadie', rol='Usuario').status_code, 404)

    def test_no_edita_documentos_de_otro_tipo(self):
        self.crear_producto('Arroz')
        self.assertEqual(self.editar('producto:alimentos:arroz', rol='Usuario').status_code, 404)

    def test_clave_original_sigue_funcionando_tras_otros_cambios(self):
        self.editar('usuario:cocina', rol='Administrador')
        self.salir()
        r = self.client.post('/api/auth/login/', {'usuario': 'cocina', 'clave': CLAVE}, format='json')
        self.assertEqual(r.status_code, 200)
