from django.urls import path
from .views import (
    CustomLoginView,
    InventarioListCreateView, 
    InventarioDetailView, 
    HistorialListCreateView, 
    DonadoresListCreateView,
    UsuariosListCreateView,
    UsuarioDetailView
)

urlpatterns = [
    path('auth/login/', CustomLoginView.as_view(), name='login'),
    path('inventario/', InventarioListCreateView.as_view(), name='inventario-list-create'),
    path('inventario/<str:doc_id>/', InventarioDetailView.as_view(), name='inventario-detail'),
    path('historial/', HistorialListCreateView.as_view(), name='historial-list-create'),
    path('donadores/', DonadoresListCreateView.as_view(), name='donadores-list-create'),
    path('usuarios/', UsuariosListCreateView.as_view(), name='usuarios-list-create'),
    path('usuarios/<str:doc_id>/', UsuarioDetailView.as_view(), name='usuario-detail'),
]