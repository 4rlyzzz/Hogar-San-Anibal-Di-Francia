from django.core.cache import cache
from rest_framework.exceptions import APIException, AuthenticationFailed
from rest_framework.permissions import BasePermission
from rest_framework_simplejwt.authentication import JWTAuthentication

from .couchdb_service import get_document_by_id

# Tiempo máximo que tarda en notarse una desactivación o un cambio de rol.
# Evita consultar CouchDB en cada request sin dejar tokens "eternos".
CACHE_SEGUNDOS = 30


class ServicioNoDisponible(APIException):
    status_code = 503
    default_detail = 'Servicio de autenticación no disponible'
    default_code = 'service_unavailable'


class IsAdminRole(BasePermission):
    """Permite el acceso únicamente a usuarios con el rol 'Administrador'."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'rol', None) == 'Administrador'
        )


class CouchDBUser:
    """Usuario en memoria para Django/DRF basado en los datos de CouchDB."""
    is_authenticated = True
    is_anonymous = False
    is_active = True

    def __init__(self, user_id, username, rol):
        self.id = user_id
        self.pk = user_id
        self.username = username
        self.rol = rol
        self.is_staff = (rol == 'Administrador')
        self.is_superuser = (rol == 'Administrador')

    def __str__(self):
        return self.username


class CouchDBJWTAuthentication(JWTAuthentication):
    """JWT que valida contra CouchDB que el usuario siga existiendo y activo,
    y toma el rol actual de la base (no del token)."""

    def get_user(self, validated_token):
        user_id = validated_token.get("user_id")
        if not user_id:
            raise AuthenticationFailed(
                "Token no válido: falta el identificador de usuario", code="user_not_found")

        datos = self._datos_usuario(user_id)

        if not datos.get('activo', True):
            raise AuthenticationFailed("Cuenta desactivada", code="user_inactive")

        username = (datos.get('usuario') or datos.get('username')
                    or validated_token.get("username", ""))
        return CouchDBUser(user_id=user_id, username=username,
                           rol=datos.get('rol', 'Usuario'))

    def _datos_usuario(self, user_id):
        clave_cache = f"couch_user:{user_id}"
        datos = cache.get(clave_cache)
        if datos is not None:
            return datos

        doc, status = get_document_by_id(user_id, 'usuario')

        if status == 200:
            datos = {
                'usuario': doc.get('usuario') or doc.get('username') or '',
                'rol': doc.get('rol', 'Usuario'),
                'activo': doc.get('activo', True),
            }
            cache.set(clave_cache, datos, CACHE_SEGUNDOS)
            return datos

        if status in (400, 404):
            # El usuario ya no existe (o el ID del token no es válido)
            raise AuthenticationFailed("Usuario no encontrado", code="user_not_found")

        # CouchDB caído u otro error: no cerramos sesión a nadie por esto
        raise ServicioNoDisponible()