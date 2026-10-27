from django.contrib.auth.hashers import make_password, check_password
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .authentication import IsAdminRole

from .couchdb_service import (
    get_all_documents,
    get_documents_by_type,
    create_document,
    get_document_by_id,
    update_document,
    delete_document
)


class CustomLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        usuario_input = (
            request.data.get('usuario') or 
            request.data.get('username') or 
            request.data.get('login-usuario') or ''
        ).strip()

        clave_input = (
            request.data.get('clave') or 
            request.data.get('password') or 
            request.data.get('login-clave') or ''
        ).strip()

        if not usuario_input or not clave_input:
            return Response({'error': 'Usuario y contraseña requeridos'}, status=400)

        docs, status_code = get_documents_by_type('usuario')
        if status_code != 200 or not isinstance(docs, list):
            return Response({'error': 'Error al consultar CouchDB'}, status=500)

        # 1. Buscar usuario por campo 'usuario' (o 'username')
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

        # 2. Validación ESTRICTA por Hash de Django
        stored_hash = user_doc.get('clave') or user_doc.get('password') or ''

        if not stored_hash or not check_password(clave_input, stored_hash):
            return Response({'error': 'Contraseña incorrecta'}, status=401)

        rol_final = user_doc.get('rol', 'Usuario')

        # 3. Emisión de Token JWT
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


class UsuariosListCreateView(APIView):
    # Solo administradores autenticados pueden listar o crear usuarios
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        data, status_code = get_documents_by_type('usuario')
        return Response(data, status=status_code)

    def post(self, request):
        """Crea un usuario en CouchDB convirtiendo la clave en un hash pbkdf2_sha256."""
        try:
            doc_data = request.data.copy()
            doc_data['tipo'] = 'usuario'

            raw_password = doc_data.get('clave') or doc_data.get('password') or ''
            if isinstance(raw_password, list):
                raw_password = raw_password[0] if raw_password else ''
            
            raw_password = str(raw_password).strip()

            if raw_password:
                # Generar el hash pbkdf2_sha256 oficial de Django
                doc_data['clave'] = make_password(raw_password)

            # Limpiar llaves sobrantes
            doc_data.pop('password', None)
            doc_data.pop('username', None)

            data, status_code = create_document(doc_data)
            return Response(data, status=status_code)

        except Exception as e:
            return Response({'error': f'Error interno: {str(e)}'}, status=500)


class UsuarioDetailView(APIView):
    # Solo administradores autenticados pueden modificar usuarios
    permission_classes = [IsAuthenticated, IsAdminRole]

    def put(self, request, doc_id):
        """Actualiza el rol o estado activo/desactivado de un usuario requiriendo _rev."""
        doc_data = request.data.copy()
        doc_data['tipo'] = 'usuario'
        
        rev = doc_data.get('_rev') or request.data.get('_rev')
        if not rev:
            return Response(
                {"error": "Se requiere la propiedad '_rev' para actualizar el usuario"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        data, status_code = update_document(doc_id, doc_data, rev)
        return Response(data, status=status_code)

class InventarioListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Lista ÚNICAMENTE los productos del inventario."""
        data, status_code = get_documents_by_type('producto')
        return Response(data, status=status_code)

    def post(self, request):
        doc_data = request.data.copy()
        if 'tipo' not in doc_data:
            doc_data['tipo'] = 'producto'
        data, status_code = create_document(doc_data)
        return Response(data, status=status_code)


class InventarioDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, doc_id):
        """Obtiene un registro por su ID."""
        data, status_code = get_document_by_id(doc_id)
        return Response(data, status=status_code)

    def put(self, request, doc_id):
        """Actualiza un registro requiriendo la propiedad _rev en la petición."""
        rev = request.data.get('_rev')
        if not rev:
            return Response(
                {"error": "Se requiere la propiedad '_rev' para actualizar el documento"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        data, status_code = update_document(doc_id, request.data, rev)
        return Response(data, status=status_code)

    def delete(self, request, doc_id):
        """Elimina un documento requiriendo la propiedad _rev."""
        rev = request.query_params.get('_rev') or request.data.get('_rev')
        if not rev:
            return Response(
                {"error": "Se requiere la propiedad '_rev' para eliminar el documento"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        data, status_code = delete_document(doc_id, rev)
        return Response(data, status=status_code)


class HistorialListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Lista los movimientos del historial ('tipo': 'movimiento')."""
        data, status_code = get_documents_by_type('movimiento')
        return Response(data, status=status_code)

    def post(self, request):
        """Registra un nuevo movimiento en el historial."""
        doc_data = request.data.copy()
        doc_data['tipo'] = 'movimiento'
        data, status_code = create_document(doc_data)
        return Response(data, status=status_code)


class DonadoresListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Lista todos los donadores ('tipo': 'donador')."""
        data, status_code = get_documents_by_type('donador')
        return Response(data, status=status_code)

    def post(self, request):
        """Registra un nuevo donador."""
        doc_data = request.data.copy()
        doc_data['tipo'] = 'donador'
        data, status_code = create_document(doc_data)
        return Response(data, status=status_code)