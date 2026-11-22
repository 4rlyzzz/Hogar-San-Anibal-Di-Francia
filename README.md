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

> **Datos de prueba (opcional):** si tu base no tiene productos y quieres probar con algo realista, ejecuta `python manage.py datos_prueba --clave <contraseña>`. Crea productos, donadores, proveedores, compradores, un equipo de usuarios de prueba (todos con esa contraseña) y movimientos de las últimas 8 semanas.

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

## 5. Dictado con IA (opcional)

Sin IA la app funciona igual: el dictado usa el reconocimiento local, que entiende menos frases. Con IA, Django le pasa lo dictado a un modelo (Groq, Gemini…) directamente, sin otro programa en medio.

1. Crear las claves (gratis):
   - **Groq:** en <https://console.groq.com> → **API Keys**. Empieza con `gsk_`.
   - **Gemini:** en <https://aistudio.google.com> → **Get API key**.
2. Poner en `backend/.env` un grupo de variables por proveedor (ya vienen en `.env.example`, solo falta la clave):

   ```
   IA_1_URL=https://api.groq.com/openai
   IA_1_KEY=gsk_...
   IA_1_MODELOS=openai/gpt-oss-20b,openai/gpt-oss-120b

   IA_2_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
   IA_2_KEY=...
   IA_2_MODELOS=gemini-3.1-flash-lite,gemini-2.5-flash
   ```

   Se prueban en orden: los modelos de `IA_1` y después los de `IA_2`. Si uno falla (llegó a su límite del día, está caído o tarda), pasa al siguiente. Para un proveedor más, agrega `IA_3_URL`, `IA_3_KEY` e `IA_3_MODELOS`.
3. Reiniciar Django (`Ctrl + C` y `python manage.py runserver`) para que lea los cambios del `.env`.

Para saber si funciona, mira la terminal de Django al dictar:

- `Dictado con IA: respondio IA_1 openai/gpt-oss-20b` → respondió ese modelo.
- `Dictado con IA: IA_1 openai/gpt-oss-20b respondio 429` → ese modelo llegó a su límite y se probó el siguiente.
- `revisa IA_1_KEY` → la clave está mal copiada.
- `respondio 404` → el nombre del modelo no existe: cópialo exacto de la página del proveedor.
- `respondio 400` → ese modelo no acepta `reasoning_effort`: pon `IA_1_REASONING=` vacío (con el número de ese proveedor).

> **Nota:** las claves van solo en `backend/.env` (o en las variables de Railway), nunca en el repositorio ni en el chat del grupo.

## 6. Actualizar después de un pull

Si alguien agregó dependencias, volver a instalarlas antes de ejecutar (con el entorno virtual activado):

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd frontend
npm install
```

Revisa también si `backend/.env.example` o `frontend/.env.example` tienen variables nuevas y agrégalas a tu `.env` (así apareció `SECRET_KEY`).

Si el cambio agregó bases nuevas en CouchDB (así llegaron `casa_proveedores` y `casa_compradores` con Merchandising), prepáralas una vez. En **backend**, con `COUCHDB_ADMIN_USER` y `COUCHDB_ADMIN_PASSWORD` en tu `.env`:

```powershell
python manage.py setup_couch
```

Lo que ya existe se deja como está: solo crea lo que falta (bases, permisos e índices). También sirve volver a correr `couchDB\setup.ps1`.

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


## 8. Merchandising, proveedores y compradores

Además de Alimentos y Salud e higiene, la sección **Merchandising** lleva lo que el hogar vende:

- **Panetón**: marca, presentación, precio y descuento por cantidad (por ejemplo, desde 6 unidades). Sus ingresos piden fecha de vencimiento y costo unitario.
- **Hecho en el hogar**: lo elaboran los chicos. *General* (rosarios, tazas, llaveros…) o *Alimentos* (con presentación y si es perecible). No tiene proveedor: el ingreso anota el taller y, si se quiere, el costo de materiales.
- **Promocionales**: lo que se manda a hacer con un proveedor. *General* o *Prendas*: cada talla y color es un producto distinto.

En Merchandising la salida es una **venta**: el precio se autocompleta (con el descuento si llega a la cantidad mínima) y se puede cambiar. Además se anota el comprador, el medio de pago y el comprobante. Proveedores y compradores tienen sus pestañas, como Donadores. Todo queda en el Historial, se filtra y se descarga en Excel.

Los productos nuevos de Merchandising se crean igual que los demás: **+ → Registrar ingreso → Crear producto nuevo → Merchandising**. El precio se cambia después desde el detalle del producto (**Editar precio y datos**).

## 9. Detener o iniciar CouchDB

Para detener o iniciar el servicio de CouchDB en Windows, abre una terminal como administrador y ejecutar, según corresponda:

```powershell
net stop "Apache CouchDB"
net start "Apache CouchDB"
```