from django.contrib.auth.hashers import make_password, check_password
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from .couchdb_service import (
    get_documents_by_type,
    create_document,
    get_document_by_id,
    update_document,
    delete_document
)
from .authentication import IsAdminRole


class CustomLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        usuario_input = (request.data.get('usuario') or request.data.get('username') or '').strip()
        clave_input = (request.data.get('clave') or request.data.get('password') or '').strip()

        if not usuario_input or not clave_input:
            return Response({'error': 'Usuario y contraseña requeridos'}, status=400)

        docs, status_code = get_documents_by_type('usuario')
        if status_code != 200 or not isinstance(docs, list):
            return Response({'error': 'Error al consultar la base de datos'}, status=500)

        user_doc = None
        for doc in docs:
            u_name = doc.get('usuario') or doc.get('username') or ''
            if u_name.lower() == usuario_input.lower():
                user_doc = doc
                break

        if not user_doc:
            return Response({'error': 'Usuario no encontrado'}, status=401)

        if not user_doc.get('activo', True):
            return Response({'error': 'Esta cuenta se encuentra desactivada'}, status=401)

        stored_hash = user_doc.get('clave') or user_doc.get('password') or ''
        if not stored_hash or not check_password(clave_input, stored_hash):
            return Response({'error': 'Contraseña incorrecta'}, status=401)

        rol_final = user_doc.get('rol', 'Usuario')

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
                'usuario': usuario_input,
                'rol': rol_final
            }
        }, status=200)


class InventarioListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data, status_code = get_documents_by_type('producto')
        return Response(data, status=status_code)

    def post(self, request):
        datos = request.data

        doc_data = {
            'tipo': 'producto',
            'nombre': str(datos.get('nombre', '')).strip(),
            'categoria': datos.get('categoria', 'alimentos'),
            'cantidad': float(datos.get('cantidad', 0)),
            'unidad': datos.get('unidad', 'unidades'),
            'stock_minimo': float(datos.get('stock_minimo', datos.get('minimo', 0))),
            'codigo': datos.get('codigo', ''),
            'codigosBarras': datos.get('codigosBarras', []),
            'lotes': datos.get('lotes', []),
            'almacen': datos.get('almacen', datos.get('ubicacion', '')),
            'envase': datos.get('envase', None),
            'contenido': datos.get('contenido', None),
            'medida': datos.get('medida', None)
        }

        if not doc_data['nombre']:
            return Response({'error': 'El nombre del producto es obligatorio'}, status=400)

        data, status_code = create_document(doc_data)
        return Response(data, status=status_code)


class InventarioDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        data, status_code = get_document_by_id(doc_id)
        return Response(data, status=status_code)

    def put(self, request, doc_id):
        rev = request.data.get('_rev')
        if not rev:
            return Response({"error": "Se requiere '_rev' para actualizar"}, status=400)

        # Sanitizar conservando todos los datos del producto
        doc_data = request.data.copy()
        doc_data['tipo'] = 'producto'

        data, status_code = update_document(doc_id, doc_data, rev)
        return Response(data, status=status_code)

    def delete(self, request, doc_id):
        if getattr(request.user, 'rol', None) != 'Administrador':
            return Response({'error': 'Solo administradores pueden eliminar productos'}, status=403)

        rev = request.query_params.get('_rev') or request.data.get('_rev')
        if not rev:
            return Response({"error": "Se requiere '_rev' para eliminar"}, status=400)

        data, status_code = delete_document(doc_id, rev)
        return Response(data, status=status_code)


class HistorialListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data, status_code = get_documents_by_type('movimiento')
        return Response(data, status=status_code)

    def post(self, request):
        datos = request.data

        # Mapeo completo garantizando todas las propiedades enviadas por registrarMovimiento
        doc_data = {
            'tipo': 'movimiento',
            'producto_id': datos.get('producto_id', None),
            'tipo_movimiento': datos.get('tipo_movimiento', 'ingreso'),
            'movimiento': datos.get('movimiento', 'Ingreso'),
            'insumo': datos.get('insumo', datos.get('nombre', '')),
            'categoria': datos.get('categoria', 'Alimentos'),
            'cantidad': float(datos.get('cantidad', 0)),
            'unidad': datos.get('unidad', 'unidades'),
            'fecha': datos.get('fecha', ''),
            'canal': datos.get('canal', 'manual'),
            'usuario_id': datos.get('usuario_id', getattr(request.user, 'id', '')),
            'responsable': datos.get('responsable', getattr(request.user, 'username', 'Usuario')),
            'donador': datos.get('donador', ''),
            'actividad': datos.get('actividad', ''),
            'para': datos.get('para', []),
            'observaciones': datos.get('observaciones', ''),
            'saldo': float(datos.get('saldo', 0)),
            'inicial': datos.get('inicial', False),
            'motivo': datos.get('motivo', None),
            'nota': datos.get('nota', None),
            'diferencia': datos.get('diferencia', None),
            'corrige': datos.get('corrige', None),
            'loteId': datos.get('loteId', None),
            'vence': datos.get('vence', None),
            'lotes': datos.get('lotes', None)
        }

        data, status_code = create_document(doc_data)
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
            'nombre': str(datos.get('nombre', '')).strip(),
            'telefono': datos.get('telefono', datos.get('contacto', '')),
            'contacto': datos.get('contacto', datos.get('telefono', '')),
            'email': datos.get('email', ''),
            'creadoPor': datos.get('creadoPor', getattr(request.user, 'username', '')),
            'creadoPorId': datos.get('creadoPorId', getattr(request.user, 'id', '')),
            'creado': datos.get('creado', None)
        }

        if not doc_data['nombre']:
            return Response({'error': 'El nombre del donador es obligatorio'}, status=400)

        data, status_code = create_document(doc_data)
        return Response(data, status=status_code)


class UsuariosListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        data, status_code = get_documents_by_type('usuario')
        return Response(data, status=status_code)

    def post(self, request):
        doc_data = request.data.copy()
        doc_data['tipo'] = 'usuario'

        raw_password = doc_data.get('clave') or doc_data.get('password') or ''
        if isinstance(raw_password, list):
            raw_password = raw_password[0] if raw_password else ''

        raw_password = str(raw_password).strip()
        if raw_password:
            doc_data['clave'] = make_password(raw_password)

        doc_data.pop('password', None)
        doc_data.pop('username', None)

        data, status_code = create_document(doc_data)
        return Response(data, status=status_code)


class UsuarioDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def put(self, request, doc_id):
        doc_data = request.data.copy()
        doc_data['tipo'] = 'usuario'

        rev = doc_data.get('_rev') or request.data.get('_rev')
        if not rev:
            return Response({"error": "Se requiere '_rev' para actualizar el usuario"}, status=400)

        # Si se envió una nueva contraseña al actualizar, encriptarla
        if 'clave' in doc_data and doc_data['clave'] and not doc_data['clave'].startswith('pbkdf2_sha256$'):
            doc_data['clave'] = make_password(doc_data['clave'])

        data, status_code = update_document(doc_id, doc_data, rev)
        return Response(data, status=status_code)