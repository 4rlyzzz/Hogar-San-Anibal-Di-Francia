from django.urls import path, include

# sin /admin/ de Django: los usuarios viven en CouchDB y se manejan desde la app
urlpatterns = [
    # endpoints de la API (login y refresh estan en api/urls.py)
    path('api/', include('api.urls')),
]
