# Hogar-San-Anibal-Di-Francia

Sistema de software para la gestión de inventario del Hogar San Aníbal Di Francia, proyecto para el curso Computación en la Sociedad CCOMP8-1.

El proyecto utiliza un frontend con Node.js/npm, un backend con Django y CouchDB para la funcionalidad de base de datos local/sincronización mediante PouchDB.

## Requisitos

Programas necesarios:

- [Node.js](https://nodejs.org/) 22 o 24 LTS (mínimo 20.19). Incluye npm.
- Python 3, con `venv` y `pip`.
- [Apache CouchDB](https://couchdb.apache.org/), configurado con una cuenta de administrador.

## 2. Configurar CouchDB

1. Instalar e iniciar Apache CouchDB y crear la cuenta de administrador.
2. Comprueba que CouchDB esté disponible en <http://127.0.0.1:5984/>.
4. Ejecutar en una terminal:

   ```powershell
   cd couchdb
   .\setup.ps1
   ```

   Si impide ejecutar el script, ejecuta lo siguiente y volver a intentar:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\setup.ps1
   ```

5. Entrar a Fauxton: <http://127.0.0.1:5984/_utils/>. Buscar **Configuración → CORS**, activar CORS y agregar los origenes de ejecutación: `http://localhost:5173` `http://localhost:8000`.


> **Nota:** La configuración de CORS debe permitir el origen real del frontend. Si el frontend se abre desde otra dirección o puerto, agrega ese origen en CouchDB.

## 3. Configurar backend (Django)

En una terminal en la raíz ejecutar lo siguiente:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Entrar a la carpeta **backend** y hacer la migracion:

```powershell
cd backend
python manage.py migrate
```

Dentro de backend crear un archivo `.env` con el siguiente contenido (llenar con los datos usados para administrar CouchDB):

```powershell
COUCHDB_URL=http://127.0.0.1:5984
COUCHDB_USER=<user>
COUCHDB_PASSWORD=<password>
COUCHDB_DB=<database name>
SECRET_KEY=django-insecure-default-key
DEBUG=True
```
> **Nota:**  No compartas ni subas el archivo `.env` al repositorio, son credenciales reales y datos críticos.
Para inicializar el servicio Django ejecutar (**1ra terminal**):

```powershell
python manage.py runserver
```

Si impide activar el entorno virtual, puedes permitir scripts únicamente para la sesión actual y volver a activarlo:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Por defecto, Django estará disponible en <http://127.0.0.1:8000/>.

Dejar esta terminal abierta mientras utilizas la aplicación. Si el proyecto ya tiene las migraciones aplicadas, `python manage.py migrate` puede ejecutarse de nuevo sin problema.

## 4. Configurar frontend (npm)

En una terminal en la raíz ejecutar lo siguiente:

```bash
cd frontend
npm install
```

Para inicializar el servicio npm ejecutar (**2da terminal**):

```bash
npm run dev
```

Abrir la dirección que indique Vite; por defecto es <http://localhost:5173/>.

Dejar ambas terminales abiertas: una ejecuta Django y la otra el servidor de desarrollo del frontend.

## 6. Prueba de CouchDB/PouchDB en modo local (opcional)

Si es necesario probar la demo independiente de CouchDB/PouchDB que se sirve como archivos estáticos, ejecutar desde la raíz del proyecto:

```powershell
cd couchdb
python -m http.server 8000
```

Luego abrir <http://localhost:8000/web/>.

**Importante:** este servidor HTTP de prueba ocupa el puerto `8000`, que también es el puerto predeterminado de Django. No ejecutes ambos servidores en el mismo puerto al mismo tiempo. Para trabajar con la aplicación completa, usa Django en la primera terminal y npm en la segunda; para probar la demo estática, detén temporalmente el servidor que esté ocupando el puerto 8000 o configura otro puerto.

Para detener o iniciar el servicio de CouchDB en Windows, abre una terminal como administrador y ejecutar, según corresponda:

```powershell
net stop "Apache CouchDB"
net start "Apache CouchDB"
```
