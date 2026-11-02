from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # endpoints de la API (login y refresh estan en api/urls.py)
    path('api/', include('api.urls')),
]
