from django.urls import path
from .dictado import DictadoView, SaludView
from .movimientos import RegistrarMovimientoView, UnirProductosView
from .views import (
    CustomLoginView,
    RenovarTokenView,
    MiCuentaView,
    CambiarClaveView,
    InventarioListCreateView, 
    InventarioDetailView, 
    HistorialListCreateView, 
    DonadoresListCreateView,
    UsuariosListCreateView,
    UsuarioDetailView
)

urlpatterns = [
    path('salud/', SaludView.as_view(), name='salud'),
    path('dictado/', DictadoView.as_view(), name='dictado'),
    path('auth/login/', CustomLoginView.as_view(), name='login'),
    path('auth/refresh/', RenovarTokenView.as_view(), name='token_refresh'),
    path('auth/yo/', MiCuentaView.as_view(), name='mi-cuenta'),
    path('auth/clave/', CambiarClaveView.as_view(), name='cambiar-clave'),
    path('inventario/', InventarioListCreateView.as_view(), name='inventario-list-create'),
    path('inventario/<str:doc_id>/', InventarioDetailView.as_view(), name='inventario-detail'),
    path('historial/', HistorialListCreateView.as_view(), name='historial-list-create'),
    path('movimientos/', RegistrarMovimientoView.as_view(), name='registrar-movimiento'),
    path('productos/unir/', UnirProductosView.as_view(), name='unir-productos'),
    path('donadores/', DonadoresListCreateView.as_view(), name='donadores-list-create'),
    path('usuarios/', UsuariosListCreateView.as_view(), name='usuarios-list-create'),
    path('usuarios/<str:doc_id>/', UsuarioDetailView.as_view(), name='usuario-detail'),
]