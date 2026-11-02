import math
from datetime import datetime, timezone

from django.contrib.auth.hashers import make_password, check_password
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .couchdb_service import (
    get_documents_by_type,
    get_document_con_secretos,
    create_document,
    get_document_by_id,
    delete_document,
    actualizar_con_reintento,
    slug,
)
from .authentication import IsAdminRole

# Hash de relleno: se usa cuando el usuario no existe para que la respuesta
# tarde lo mismo y no se pueda averiguar qué usuarios existen por el tiempo.
DUMMY_HASH = make_password('relleno-para-igualar-tiempos')

# Listas blancas: solo estos campos se aceptan desde el cliente
# cantidad y lotes no: el stock solo cambia con un movimiento (movimientos.py)
CAMPOS_PRODUCTO = (
    'nombre', 'stock_minimo', 'minimo',
    'codigo', 'codigosBarras', 'almacen', 'ubicacion',
    'envase', 'contenido', 'medida', 'unidos',
)
CAMPOS_USUARIO = ('nombre', 'usuario', 'rol', 'activo')
ROLES = ('Usuario', 'Administrador')
# cambios de rol/estado que se guardan por cuenta
MAX_CAMBIOS = 50


def _solo_campos(data, permitidos):
    return {k: data[k] for k in permitidos if k in data}


class DatoInvalido(Exception):
    pass


# tope de cualquier cantidad (igual que cantidadMaxima en validacion.js)
CANTIDAD_MAXIMA = 100000


def _numero(datos, campo, defecto=0, mayor_que_cero=False):
    """Lee un numero entre 0 y CANTIDAD_MAXIMA; si no lo es lanza DatoInvalido."""
    try:
        valor = float(datos.get(campo, defecto))
    except (TypeError, ValueError):
        raise DatoInvalido(f"'{campo}' debe ser un número")
    if not math.isfinite(valor) or valor < 0 or (mayor_que_cero and valor == 0):
        raise DatoInvalido(f"'{campo}' debe ser un número mayor {'que' if mayor_que_cero else 'o igual a'} 0")
    if valor > CANTIDAD_MAXIMA:
        raise DatoInvalido(f"'{campo}' no puede ser mayor que {CANTIDAD_MAXIMA}")
    return valor


def _ahora():
    return datetime.now(timezone.utc).isoformat()


def _clave_invalida(clave):
    """Mismas reglas que claveNueva en validacion.js. Devuelve el error o None."""
    if len(clave) < 8:
        return 'La contraseña debe tener al menos 8 caracteres'
    if len(clave) > 64:
        return 'La contraseña puede tener hasta 64 caracteres'
    if not any(c.isalpha() for c in clave) or not any(c.isdigit() for c in clave):
        return 'La contraseña debe tener letras y números'
    return None


def principal_id(usuarios):
    """La cuenta principal (el primer administrador) no se puede cambiar ni desactivar.
    Es la marcada con 'principal'; si ninguna lo esta (bases viejas), el administrador mas antiguo
    (sin fecha cuenta como el mas antiguo: lo creo el comando crear_usuario)."""
    marcada = next((u for u in usuarios if u.get('principal')), None)
    if marcada:
        return marcada['_id']
    admins = [u for u in usuarios if u.get('rol') == 'Administrador']
    if not admins:
        return None
    return min(admins, key=lambda u: u.get('creado') or '')['_id']


def _nombre_donador(nombre):
    """'parroquia san josé' -> 'Parroquia San José'. Las siglas (ONG) se respetan,
    salvo que todo venga en mayusculas. Igual que nombreDonador en logica/donadores.js."""
    palabras = str(nombre or '').split()
    todo_mayuscula = ' '.join(palabras) == ' '.join(palabras).upper()
    return ' '.join(
        p if (not todo_mayuscula and len(p) > 1 and p == p.upper()) else p[:1].upper() + p[1:].lower()
        for p in palabras
    )


class CustomLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    # Limita intentos por IP (la tasa 'login' se define en settings.py)
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        usuario_input = (request.data.get('usuario') or request.data.get('username') or '').strip()
        clave_input = (request.data.get('clave') or request.data.get('password') or '').strip()

        if not usuario_input or not clave_input:
            return Response({'error': 'Usuario y contraseña requeridos'}, status=400)

        docs, status_code = get_documents_by_type('usuario', con_secretos=True)
        if status_code != 200 or not isinstance(docs, list):
            return Response({'error': 'Error al consultar la base de datos'}, status=500)

        user_doc = None
        for doc in docs:
            u_name = doc.get('usuario') or doc.get('username') or ''
            if u_name.lower() == usuario_input.lower():
                user_doc = doc
                break

        # Siempre se ejecuta check_password (aunque no exista el usuario)
        real_hash = (user_doc.get('clave') or user_doc.get('password') or '') if user_doc else ''
        password_ok = check_password(clave_input, real_hash or DUMMY_HASH) and bool(real_hash)

        # Mismo mensaje para "no existe" y "contraseña incorrecta"
        if not user_doc or not password_ok:
            return Response({'error': 'Credenciales inválidas'}, status=401)

        if not user_doc.get('activo', True):
            return Response({'error': 'Esta cuenta se encuentra desactivada'}, status=401)

        rol_final = user_doc.get('rol', 'Usuario')

        # ultimo acceso (si no se puede guardar, igual se entra)
        actualizar_con_reintento(user_doc['_id'], 'usuario', lambda doc: {'ultimoAcceso': _ahora()})

        refresh = RefreshToken()
        refresh['user_id'] = user_doc.get('_id') or user_doc.get('id')
        refresh['username'] = usuario_input
        refresh['rol'] = rol_final

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'usuario': {
                'id': user_doc.get('_id') or user_doc.get('id'),
                'nombre': user_doc.get('nombre', usuario_input),
                # el usuario como esta guardado (no como se tecleo: 'Admin' y 'admin' son la misma cuenta)
                'usuario': user_doc.get('usuario') or user_doc.get('username') or usuario_input,
                'rol': rol_final
            }
        }, status=200)


class RenovarTokenView(APIView):
    """Renueva la sesion revisando en CouchDB que el usuario siga activo.
    (la vista de simplejwt busca al usuario en la tabla de Django y falla)"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            refresh = RefreshToken(str(request.data.get('refresh', '')))
        except TokenError:
            return Response({'error': 'La sesión venció'}, status=401)

        doc, status_code = get_document_by_id(refresh.get('user_id'), 'usuario')
        if status_code in (400, 404):
            return Response({'error': 'Usuario no encontrado'}, status=401)
        if status_code != 200:
            return Response({'error': 'Servicio no disponible'}, status=503)
        if not doc.get('activo', True):
            return Response({'error': 'Esta cuenta se encuentra desactivada'}, status=401)

        # token nuevo con el rol actual
        refresh['rol'] = doc.get('rol', 'Usuario')
        refresh.set_jti()
        refresh.set_exp()
        refresh.set_iat()

        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)}, status=200)


class MiCuentaView(APIView):
    """Datos actuales de quien inició sesión: si un admin le cambió el rol,
    la pantalla se actualiza sin volver a entrar."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doc, status_code = get_document_by_id(request.user.id, 'usuario')
        if status_code != 200:
            return Response(doc, status=status_code)
        return Response({
            'id': doc['_id'],
            'nombre': doc.get('nombre', ''),
            'usuario': doc.get('usuario') or doc.get('username') or '',
            'rol': doc.get('rol', 'Usuario'),
        }, status=200)


class InventarioListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data, status_code = get_documents_by_type('producto')
        return Response(data, status=status_code)

    def post(self, request):
        datos = request.data

        try:
            minimo = _numero(datos, 'stock_minimo' if 'stock_minimo' in datos else 'minimo')
        except DatoInvalido as e:
            return Response({'error': str(e)}, status=400)

        categoria = 'salud' if str(datos.get('categoria', '')).lower() == 'salud' else 'alimentos'
        doc_data = {
            'tipo': 'producto',
            'nombre': ' '.join(str(datos.get('nombre', '')).split())[:60],
            'categoria': categoria,
            # nace sin stock: lo que entra se registra con un ingreso (movimientos/)
            'cantidad': 0,
            'unidad': datos.get('unidad', 'unidades'),
            'stock_minimo': minimo,
            'codigo': datos.get('codigo', ''),
            'codigosBarras': datos.get('codigosBarras', []),
            'lotes': [],
            'almacen': datos.get('almacen', datos.get('ubicacion', '')),
            'envase': datos.get('envase', None),
            'contenido': datos.get('contenido', None),
            'medida': datos.get('medida', None),
            'unidos': datos.get('unidos', [])
        }

        if not doc_data['nombre']:
            return Response({'error': 'El nombre del producto es obligatorio'}, status=400)

        repetido = _producto_con_nombre(categoria, doc_data['nombre'])
        if repetido is False:
            return Response({'error': 'Error al consultar la base de datos'}, status=503)
        if repetido:
            return Response({'error': f"Ya existe \"{repetido['nombre']}\": elígelo en vez de crearlo otra vez"}, status=409)

        # identificador fijo: si dos personas lo crean a la vez, CouchDB deja solo uno
        data, status_code = create_document(doc_data, f"producto:{categoria}:{slug(doc_data['nombre'])}")
        if status_code == 409:
            return Response({'error': f"Ya existe \"{doc_data['nombre']}\" (otra persona lo acaba de crear)"}, status=409)
        return Response(data, status=status_code)


def _producto_con_nombre(categoria, nombre, excepto=None):
    """El producto de esa categoria con el mismo nombre (sin importar tildes ni mayusculas), None si no hay, False si fallo."""
    productos, status_code = get_documents_by_type('producto')
    if status_code != 200:
        return False
    buscado = slug(nombre)
    for p in productos:
        es_salud = str(p.get('categoria', '')).lower() in ('salud', 'medicinas', 'higiene')
        if p['_id'] != excepto and (es_salud == (categoria == 'salud')) and slug(p.get('nombre')) == buscado:
            return p
    return None


class InventarioDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        data, status_code = get_document_by_id(doc_id, 'producto')
        return Response(data, status=status_code)

    def put(self, request, doc_id):
        # Solo campos de producto permitidos (nunca el stock); el resto del documento se conserva
        doc_data = _solo_campos(request.data, CAMPOS_PRODUCTO)

        try:
            for campo in ('stock_minimo', 'minimo'):
                if campo in doc_data:
                    doc_data[campo] = _numero(doc_data, campo)
        except DatoInvalido as e:
            return Response({'error': str(e)}, status=400)

        if 'nombre' in doc_data:
            doc_data['nombre'] = ' '.join(str(doc_data['nombre']).split())[:60]
            actual, status_code = get_document_by_id(doc_id, 'producto')
            if status_code != 200:
                return Response(actual, status=status_code)
            categoria = 'salud' if str(actual.get('categoria', '')).lower() in ('salud', 'medicinas', 'higiene') else 'alimentos'
            repetido = _producto_con_nombre(categoria, doc_data['nombre'], excepto=doc_id)
            if repetido:
                return Response({'error': f"Ya existe otro producto llamado \"{repetido['nombre']}\""}, status=409)

        # sobre la version actual: si se cruza con un movimiento, se reintenta (no se pisa el stock)
        data, status_code = actualizar_con_reintento(doc_id, 'producto', lambda doc: doc_data)
        return Response(data, status=status_code)

    def delete(self, request, doc_id):
        if getattr(request.user, 'rol', None) != 'Administrador':
            return Response({'error': 'Solo administradores pueden eliminar productos'}, status=403)

        rev = request.query_params.get('_rev') or request.data.get('_rev')
        if not rev:
            return Response({"error": "Se requiere '_rev' para eliminar"}, status=400)

        data, status_code = delete_document(doc_id, rev, 'producto')
        return Response(data, status=status_code)


class HistorialListCreateView(APIView):
    """Solo lectura: los movimientos se crean en movimientos/ junto con el cambio de stock."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data, status_code = get_documents_by_type('movimiento')
        return Response(data, status=status_code)


class DonadoresListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data, status_code = get_documents_by_type('donador')
        return Response(data, status=status_code)

    def post(self, request):
        datos = request.data

        doc_data = {
            'tipo': 'donador',
            # primera letra de cada palabra en mayuscula
            'nombre': _nombre_donador(datos.get('nombre', '')),
            'telefono': datos.get('telefono', datos.get('contacto', '')),
            'contacto': datos.get('contacto', datos.get('telefono', '')),
            'email': datos.get('email', ''),
            'observaciones': ' '.join(str(datos.get('observaciones') or '').split())[:200],
            # Quién lo creó sale del token, no del cliente
            'creadoPor': getattr(request.user, 'nombre', ''),
            'creadoPorId': getattr(request.user, 'id', ''),
            'creado': datos.get('creado') or _ahora()
        }

        if not doc_data['nombre']:
            return Response({'error': 'El nombre del donador es obligatorio'}, status=400)

        # los donadores viejos tienen otro tipo de identificador: se revisa el nombre
        existentes, status_code = get_documents_by_type('donador')
        if status_code != 200:
            return Response(existentes, status=status_code)
        clave = slug(doc_data['nombre'])
        if any(slug(d.get('nombre')) == clave for d in existentes):
            return Response({'error': f"\"{doc_data['nombre']}\" ya está registrado"}, status=409)

        # identificador fijo: si dos personas lo crean a la vez, CouchDB deja solo uno
        data, status_code = create_document(doc_data, f'donador:{clave}')
        if status_code == 409:
            return Response({'error': f"\"{doc_data['nombre']}\" ya está registrado (otra persona lo acaba de agregar)"}, status=409)
        return Response(data, status=status_code)


class UsuariosListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        # get_documents_by_type ya quita el hash 'clave' por defecto
        data, status_code = get_documents_by_type('usuario')
        if status_code == 200:
            principal = principal_id(data)
            data = [{**u, 'principal': u['_id'] == principal} for u in data]
        return Response(data, status=status_code)

    def post(self, request):
        doc_data = _solo_campos(request.data, CAMPOS_USUARIO)
        doc_data['tipo'] = 'usuario'
        doc_data['rol'] = doc_data.get('rol', 'Usuario')
        doc_data['activo'] = True
        if doc_data['rol'] not in ROLES:
            return Response({'error': 'Rol no válido'}, status=400)

        nombre_usuario = str(doc_data.get('usuario', '')).strip()
        raw_password = str(request.data.get('clave') or request.data.get('password') or '').strip()

        if not nombre_usuario or not raw_password:
            return Response({'error': 'Usuario y contraseña son obligatorios'}, status=400)
        error = _clave_invalida(raw_password)
        if error:
            return Response({'error': error}, status=400)

        # Evitar usuarios duplicados (un duplicado podría "tapar" a otro en el login)
        existentes, status_code = get_documents_by_type('usuario')
        if status_code != 200:
            return Response(existentes, status=status_code)
        if any((d.get('usuario') or d.get('username') or '').lower() == nombre_usuario.lower()
               for d in existentes):
            return Response({'error': 'Ese usuario ya existe'}, status=409)

        doc_data['usuario'] = nombre_usuario
        doc_data['clave'] = make_password(raw_password)
        # quien y cuando la creo (sale del token, no del cliente)
        doc_data['creado'] = _ahora()
        doc_data['creadoPor'] = getattr(request.user, 'nombre', '')
        doc_data['creadoPorId'] = getattr(request.user, 'id', '')

        # identificador fijo: dos admins creando el mismo usuario a la vez -> CouchDB deja solo uno
        data, status_code = create_document(doc_data, f'usuario:{slug(nombre_usuario)}')
        if status_code == 409:
            return Response({'error': 'Ese usuario ya existe'}, status=409)
        return Response(data, status=status_code)


class UsuarioDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def put(self, request, doc_id):
        doc_data = _solo_campos(request.data, CAMPOS_USUARIO)

        if 'rol' in doc_data and doc_data['rol'] not in ROLES:
            return Response({'error': 'Rol no válido'}, status=400)
        if 'activo' in doc_data and not isinstance(doc_data['activo'], bool):
            return Response({'error': "'activo' debe ser verdadero o falso"}, status=400)

        # el admin no puede quitarse el rol ni desactivarse (se quedaria sin acceso)
        if str(doc_id) == str(request.user.id) and (
            doc_data.get('rol', 'Administrador') != 'Administrador' or doc_data.get('activo', True) is False
        ):
            return Response({'error': 'No puedes quitarte el rol ni desactivar tu propia cuenta'}, status=400)

        # la cuenta principal no la cambia nadie (su contraseña la cambia ella misma en auth/clave/)
        todos, status_code = get_documents_by_type('usuario')
        if status_code != 200:
            return Response(todos, status=status_code)
        if str(doc_id) == str(principal_id(todos)):
            return Response({'error': 'La cuenta principal no se puede modificar'}, status=403)

        # Solo se cambia la contraseña si llega una nueva (siempre se hashea);
        # si no llega, fusionar=True conserva el hash actual.
        nueva = str(request.data.get('clave') or request.data.get('password') or '').strip()
        if nueva:
            error = _clave_invalida(nueva)
            if error:
                return Response({'error': error}, status=400)
            doc_data['clave'] = make_password(nueva)

        # cambios de rol y de estado: quedan en la cuenta para la actividad de quien los hizo
        # valor: el rol nuevo, o si quedo activa
        # se calculan con la version actual (si dos admins cambian a la vez, se reintenta y no se pierde ninguno)
        def aplicar(actual):
            cambios = []
            if 'rol' in doc_data and doc_data['rol'] != actual.get('rol', 'Usuario'):
                cambios.append({'accion': 'rol', 'valor': doc_data['rol']})
            if 'activo' in doc_data and doc_data['activo'] != actual.get('activo', True):
                cambios.append({'accion': 'estado', 'valor': doc_data['activo']})
            if nueva:
                # la contraseña no se guarda en el registro, solo que se cambio
                cambios.append({'accion': 'clave', 'valor': True})
            if not cambios:
                return doc_data
            ahora = _ahora()
            nuevos = [{**c, 'quienId': request.user.id, 'quien': request.user.nombre, 'fecha': ahora} for c in cambios]
            return {**doc_data, 'cambios': (actual.get('cambios') or [])[-(MAX_CAMBIOS - len(nuevos)):] + nuevos}

        # sin el _rev del cliente: rol y estado se aplican sobre la version actual
        # (el login cambia 'ultimoAcceso' y con un _rev viejo daria conflicto)
        data, status_code = actualizar_con_reintento(doc_id, 'usuario', aplicar)
        if status_code in (200, 201):
            # que el cambio de rol o la desactivacion se note ya, no a los 30 s
            cache.delete(f"couch_user:{doc_id}")
        return Response(data, status=status_code)

class CambiarClaveView(APIView):
    """Cada uno cambia su propia contraseña sabiendo la actual (tambien la cuenta principal)."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        actual = str(request.data.get('actual') or '')
        nueva = str(request.data.get('nueva') or '').strip()

        doc, status_code = get_document_con_secretos(request.user.id, 'usuario')
        if status_code != 200:
            return Response({'error': 'No se encontró tu cuenta'}, status=status_code)
        if not check_password(actual.strip(), doc.get('clave') or doc.get('password') or DUMMY_HASH):
            return Response({'error': 'La contraseña actual no es correcta'}, status=400)
        error = _clave_invalida(nueva)
        if error:
            return Response({'error': error}, status=400)

        data, status_code = actualizar_con_reintento(doc['_id'], 'usuario', lambda d: {'clave': make_password(nueva)})
        if status_code not in (200, 201):
            return Response(data, status=status_code)
        return Response({'ok': True}, status=200)
