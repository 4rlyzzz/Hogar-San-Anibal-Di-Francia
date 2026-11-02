from django.core.cache import cache

from .base import CLAVE, PruebaAPI


class LoginTests(PruebaAPI):
    def entrar(self, usuario, clave):
        return self.client.post('/api/auth/login/', {'usuario': usuario, 'clave': clave}, format='json')

    def test_login_correcto_devuelve_tokens_y_datos(self):
        r = self.entrar('admin', CLAVE)
        self.assertEqual(r.status_code, 200)
        self.assertIn('access', r.data)
        self.assertIn('refresh', r.data)
        self.assertEqual(r.data['usuario'], {'id': 'usuario:admin', 'nombre': 'Dirección', 'usuario': 'admin', 'rol': 'Administrador'})

    def test_login_no_distingue_mayusculas_en_el_usuario(self):
        r = self.entrar('ADMIN', CLAVE)
        self.assertEqual(r.status_code, 200)
        # devuelve el usuario como esta guardado
        self.assertEqual(r.data['usuario']['usuario'], 'admin')

    def test_login_guarda_ultimo_acceso(self):
        self.entrar('cocina', CLAVE)
        self.assertIn('ultimoAcceso', self.couch.leer('usuario', 'usuario:cocina'))

    def test_clave_incorrecta_y_usuario_inexistente_dan_el_mismo_error(self):
        mala = self.entrar('admin', 'otra12345')
        inexistente = self.entrar('nadie', CLAVE)
        self.assertEqual(mala.status_code, 401)
        self.assertEqual(inexistente.status_code, 401)
        self.assertEqual(mala.data, inexistente.data)

    def test_faltan_datos(self):
        self.assertEqual(self.entrar('', CLAVE).status_code, 400)
        self.assertEqual(self.entrar('admin', '').status_code, 400)

    def test_cuenta_desactivada_no_entra(self):
        self.crear_usuario('vieja', 'Usuario', activo=False)
        r = self.entrar('vieja', CLAVE)
        self.assertEqual(r.status_code, 401)
        self.assertIn('desactivada', r.data['error'])

    def test_couchdb_caida_da_error_controlado(self):
        self.couch.caida = True
        self.assertEqual(self.entrar('admin', CLAVE).status_code, 500)

    def test_limite_de_intentos_por_minuto(self):
        for _ in range(5):
            self.entrar('admin', 'mala12345')
        self.assertEqual(self.entrar('admin', CLAVE).status_code, 429)


class TokenTests(PruebaAPI):
    def test_sin_token_no_hay_acceso(self):
        for url in ('/api/inventario/', '/api/historial/', '/api/donadores/', '/api/auth/yo/'):
            self.assertEqual(self.client.get(url).status_code, 401, url)

    def test_token_invalido(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer basura')
        self.assertEqual(self.client.get('/api/inventario/').status_code, 401)

    def test_mi_cuenta(self):
        self.entrar_como(self.usuario)
        r = self.client.get('/api/auth/yo/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data, {'id': 'usuario:cocina', 'nombre': 'Cocina', 'usuario': 'cocina', 'rol': 'Usuario'})

    def test_el_rol_sale_de_la_base_y_no_del_token(self):
        # el token dice Administrador, pero en la base ya es Usuario
        self.entrar_como({**self.usuario, 'rol': 'Administrador'})
        self.assertEqual(self.client.get('/api/usuarios/').status_code, 403)

    def test_cuenta_desactivada_pierde_el_acceso(self):
        self.entrar_como(self.usuario)
        self.assertEqual(self.client.get('/api/inventario/').status_code, 200)
        doc = self.couch.leer('usuario', 'usuario:cocina')
        self.couch.poner('usuario', {**doc, 'activo': False})
        cache.clear()
        self.assertEqual(self.client.get('/api/inventario/').status_code, 401)

    def test_cuenta_borrada_pierde_el_acceso(self):
        self.entrar_como(self.usuario)
        del self.couch.base('usuario')['usuario:cocina']
        self.assertEqual(self.client.get('/api/inventario/').status_code, 401)

    def test_couchdb_caida_no_cierra_la_sesion(self):
        self.entrar_como(self.usuario)
        self.couch.caida = True
        self.assertEqual(self.client.get('/api/inventario/').status_code, 503)


class RenovarTokenTests(PruebaAPI):
    def renovar(self, refresh):
        return self.client.post('/api/auth/refresh/', {'refresh': refresh}, format='json')

    def test_renueva_con_el_rol_actual(self):
        refresh = self.entrar_como(self.usuario)
        doc = self.couch.leer('usuario', 'usuario:cocina')
        self.couch.poner('usuario', {**doc, 'rol': 'Administrador'})
        r = self.renovar(str(refresh))
        self.assertEqual(r.status_code, 200)
        from rest_framework_simplejwt.tokens import AccessToken
        self.assertEqual(AccessToken(r.data['access'])['rol'], 'Administrador')

    def test_refresh_invalido(self):
        self.assertEqual(self.renovar('basura').status_code, 401)

    def test_no_renueva_si_la_cuenta_se_desactivo(self):
        refresh = self.entrar_como(self.usuario)
        doc = self.couch.leer('usuario', 'usuario:cocina')
        self.couch.poner('usuario', {**doc, 'activo': False})
        self.assertEqual(self.renovar(str(refresh)).status_code, 401)

    def test_no_renueva_si_la_cuenta_no_existe(self):
        refresh = self.entrar_como(self.usuario)
        del self.couch.base('usuario')['usuario:cocina']
        self.assertEqual(self.renovar(str(refresh)).status_code, 401)


class CambiarClaveTests(PruebaAPI):
    def cambiar(self, actual, nueva):
        return self.client.post('/api/auth/clave/', {'actual': actual, 'nueva': nueva}, format='json')

    def test_cambia_la_clave_y_se_puede_entrar_con_la_nueva(self):
        self.entrar_como(self.usuario)
        self.assertEqual(self.cambiar(CLAVE, 'nueva98765').status_code, 200)
        self.salir()
        cache.clear()
        r = self.client.post('/api/auth/login/', {'usuario': 'cocina', 'clave': 'nueva98765'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_clave_actual_incorrecta(self):
        self.entrar_como(self.usuario)
        self.assertEqual(self.cambiar('mala12345', 'nueva98765').status_code, 400)

    def test_clave_nueva_debil(self):
        self.entrar_como(self.usuario)
        for debil in ('corta1', 'sololetras', '12345678', 'a1' * 40):
            self.assertEqual(self.cambiar(CLAVE, debil).status_code, 400, debil)

    def test_la_cuenta_principal_tambien_puede_cambiar_su_clave(self):
        self.entrar_como(self.admin)
        self.assertEqual(self.cambiar(CLAVE, 'nueva98765').status_code, 200)
