# Hogar-San-Anibal-Di-Francia

Sistema de software para la gestión de inventario del Hogar San Aníbal Di Francia, proyecto para el curso Computación en la Sociedad CCOMP8-1.

El proyecto utiliza un frontend con React + Vite (npm), un backend con Django y CouchDB como base de datos.

## 1. Requisitos

Programas necesarios:

- [Node.js](https://nodejs.org/) 22 o 24 LTS (mínimo 20.19). Incluye npm.
- Python 3, con `venv` y `pip`.
- [Apache CouchDB](https://couchdb.apache.org/), configurado con una cuenta de administrador.

## 2. Configurar CouchDB

1. Instalar e iniciar Apache CouchDB y crear la cuenta de administrador.
2. Comprueba que CouchDB esté disponible en <http://127.0.0.1:5984/>.
3. Ejecutar en una terminal:

   ```powershell
   cd couchDB
   .\setup.ps1
   ```

   Si impide ejecutar el script, ejecuta lo siguiente y volver a intentar:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   .\setup.ps1
   ```

   El script pide la cuenta de administrador de CouchDB y una contraseña nueva para `casa_app` (la cuenta con la que Django usa la base). Anota esa contraseña: se pone en el `.env` del backend. También crea las bases y carga los datos de `datos_actuales.json`.

> **Nota:** No hace falta activar CORS en CouchDB. El navegador nunca habla con CouchDB, solo Django.

## 3. Configurar backend (Django)

En una terminal en la raíz ejecutar lo siguiente:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Antes de la migración hay que crear el `.env`, porque sin él Django no arranca. Dentro de **backend** copiar `.env.example` como `.env` y llenarlo:

- `SECRET_KEY`: cualquier clave larga. Para generar una:

  ```powershell
  python -c "import secrets; print(secrets.token_urlsafe(50))"
  ```

- `DEBUG=True` (ya viene así en el ejemplo).
- `COUCHDB_PASSWORD`: la contraseña de `casa_app` que pusiste en `setup.ps1`.

Igual en frontend: copiar `frontend/.env.example` como `frontend/.env` (ya trae la dirección del backend local).

> **Nota:**  No compartas ni subas el archivo `.env` al repositorio, son credenciales reales y datos críticos.

> **Error de SECRET_KEY:** si el backend dice que falta la variable SECRET_KEY, agrégala a tu `backend/.env`

> **Publicar en internet:** ver [DESPLIEGUE.md](DESPLIEGUE.md) (Railway).

Entrar a la carpeta **backend** y hacer la migracion:

```powershell
cd backend
python manage.py migrate
```

Crear el primer administrador (pide usuario, nombre y contraseña; solo se hace una vez):

```powershell
python manage.py crear_usuario
```

Los demás usuarios se agregan desde la app, en la pestaña **Usuarios**.

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

Dejar ambas terminales abiertas: una ejecuta Django y la otra el servidor de desarrollo del frontend. Si usas el dictado con IA, también la de OmniRoute (sección 5).

## 5. Dictado con IA: OmniRoute (opcional)

Sin OmniRoute la app funciona igual: el dictado usa el reconocimiento local, que entiende menos frases. Con OmniRoute, Django le pasa lo dictado a un modelo de IA (Groq, Gemini, etc.).

Para inicializar OmniRoute ejecutar (**3ra terminal**):

```bash
npx omniroute
```

Por defecto abre su panel en <http://localhost:20128/>. Ahí, la primera vez:

1. Conectar un proveedor (por ejemplo Groq) con su API key, creada en la página de ese proveedor.
2. Crear un **combo** con los modelos a usar (por ejemplo `inventario-fallback`).
3. Crear una **API key** de OmniRoute para que Django pueda usarlo.

Luego poner en `backend/.env`:

- `OMNIROUTE_URL=http://localhost:20128`
- `OMNIROUTE_API_KEY`: la API key creada en OmniRoute (el paso 3).
- `OMNIROUTE_MODEL`: el nombre **exacto** del combo (el paso 2). Si no coincide, la IA falla y el dictado usa el reconocimiento local sin avisar.

Reiniciar Django (`Ctrl + C` y `python manage.py runserver`) para que lea los cambios del `.env`.

> **Nota:** si el modelo rechaza el parámetro `reasoning_effort`, pon `OMNIROUTE_REASONING_EFFORT=` vacío en `backend/.env`.

## 6. Actualizar después de un pull

Si alguien agregó dependencias, volver a instalarlas antes de ejecutar (con el entorno virtual activado):

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd frontend
npm install
```

Revisa también si `backend/.env.example` o `frontend/.env.example` tienen variables nuevas y agrégalas a tu `.env` (así apareció `SECRET_KEY`).

## 7. Pruebas de regresión

Antes de subir cambios (o después de un pull), revisa que todo lo que ya funcionaba siga funcionando. En una terminal en la raíz ejecutar:

```powershell
.\pruebas.ps1
```

Ejecuta, en orden: la revisión de Django, las pruebas del backend (login, sesiones, inventario, movimientos de stock, donadores, usuarios y comandos), las pruebas de la lógica del frontend (validaciones, lotes, alertas, filtros, historial y dictado), el lint y el build. Al final muestra un resumen; si algo falla, termina con error y dice qué paso falló.

- No necesita CouchDB encendido ni toca la base real: el backend se prueba con una CouchDB falsa en memoria.
- Sí necesita el `backend/.env` con `SECRET_KEY` (sección 3); sin él falla en el primer paso.
- `.\pruebas.ps1 -Rapido` corre solo las pruebas (sin lint ni build).
- Por separado: `python manage.py test api` (en **backend**) o `npm test` (en **frontend**).
- Las pruebas están en `backend/api/tests/` y `frontend/pruebas/`. Al agregar una funcionalidad nueva, agrega también su prueba.


## 8. Detener o iniciar CouchDB

Para detener o iniciar el servicio de CouchDB en Windows, abre una terminal como administrador y ejecutar, según corresponda:

```powershell
net stop "Apache CouchDB"
net start "Apache CouchDB"
```