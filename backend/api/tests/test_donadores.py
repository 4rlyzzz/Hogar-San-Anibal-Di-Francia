from api.views import _nombre_donador

from .base import PruebaAPI


class NombreDonadorTests(PruebaAPI):
    def test_mayuscula_en_cada_palabra(self):
        self.assertEqual(_nombre_donador('parroquia  san josé'), 'Parroquia San José')

    def test_respeta_siglas(self):
        self.assertEqual(_nombre_donador('ONG manos unidas'), 'ONG Manos Unidas')

    def test_todo_en_mayusculas_se_normaliza(self):
        self.assertEqual(_nombre_donador('FAMILIA PEREZ'), 'Familia Perez')


class DonadoresTests(PruebaAPI):
    def setUp(self):
        super().setUp()
        self.entrar_como(self.usuario)

    def crear(self, **datos):
        return self.client.post('/api/donadores/', {'nombre': 'parroquia san josé', 'telefono': '987654321', **datos}, format='json')

    def test_crea_donador(self):
        r = self.crear(observaciones='  dona   cada mes ', creadoPor='Otro', creadoPorId='usuario:admin')
        self.assertEqual(r.status_code, 201)
        doc = self.couch.leer('donador', 'donador:parroquia-san-jose')
        self.assertEqual(doc['nombre'], 'Parroquia San José')
        self.assertEqual(doc['telefono'], '987654321')
        self.assertEqual(doc['observaciones'], 'dona cada mes')
        # quien lo creo sale del token, no de lo que manda el navegador
        self.assertEqual((doc['creadoPor'], doc['creadoPorId']), ('Cocina', 'usuario:cocina'))

    def test_nombre_obligatorio(self):
        self.assertEqual(self.crear(nombre='  ').status_code, 400)

    def test_no_repite_donadores(self):
        self.crear()
        self.assertEqual(self.crear(nombre='PARROQUIA SAN JOSE').status_code, 409)
        self.assertEqual(len(self.couch.todos('donador')), 1)

    def test_no_repite_donadores_viejos_con_otro_id(self):
        self.couch.poner('donador', {'nombre': 'Parroquia San José'})
        self.assertEqual(self.crear().status_code, 409)

    def test_lista_donadores(self):
        self.crear()
        self.crear(nombre='Familia Pérez')
        r = self.client.get('/api/donadores/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(sorted(d['nombre'] for d in r.data), ['Familia Pérez', 'Parroquia San José'])
