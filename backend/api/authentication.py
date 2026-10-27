from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

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
    def __init__(self, user_id, username, rol):
        self.id = user_id
        self.pk = user_id
        self.username = username
        self.rol = rol
        self.is_authenticated = True
        self.is_active = True
        self.is_staff = (rol == 'Administrador')
        self.is_superuser = (rol == 'Administrador')

    def __str__(self):
        return self.username


class CouchDBJWTAuthentication(JWTAuthentication):
    """Autenticación JWT personalizada que evita consultar la tabla SQL de Django."""
    def get_user(self, validated_token):
        user_id = validated_token.get("user_id")
        username = validated_token.get("username", "")
        rol = validated_token.get("rol", "Usuario")

        if not user_id:
            raise AuthenticationFailed("Token no válido: falta el identificador de usuario", code="user_not_found")

        return CouchDBUser(user_id=user_id, username=username, rol=rol)