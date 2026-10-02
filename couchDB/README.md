# Casa Hogar - Demo CouchDB + PouchDB
Esta es una demo basica para la utilización de CouchDB con el intento de conexión asincrona de forma local con PouchDB

# Requerimientos
Se va a requerir tener:
- CouchDB (configurada con la cuenta de prueba)
- PouchDB
- Navegador Web
- Python 3

# Pasos para ejecución
1. Instalar CouchDB, crear cuenta de administrador de CouchDB, verificar que funciona en **http://127.0.0.1:5984/**
2. Configurar las credenciales de .env.example creando un .env colocando los campos de contraseña y verificar los usuarios correctamente
3. Hacer **cd couchdb** y ejecutar **.\setup.ps1**. Si impide Windows ejecutar **Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass** y rejecutar
4. Ir a la sección de CORS, ingresar a Fauxton con **http://127.0.0.1:5984/_utils/** buscar Configuración y seleccionar CORS, activar CORS y añadir **http://localhost:8000**
5. Para verificar correr en terminal **python -m http.server 8000** y abrir en navegador **http://localhost:8000**
6. EXTRA | Para probar la conexión offline  
    6.1 **net stop "Apache CouchDB"** para detener la conexión  
    6.2 **net start "Apache CouchDB"** para empezar la conexión  