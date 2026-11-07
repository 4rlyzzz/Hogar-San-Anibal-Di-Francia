# Despliegue en Railway

Guía para publicar el sistema en [Railway](https://railway.com) (plan Hobby). Para desarrollar en tu PC sigue usando el [README](README.md): `runserver` + `npm run dev`.

## 1. Cómo queda armado

Un **proyecto** de Railway con 3 servicios (4 si después agregas OmniRoute), todos desde este mismo repositorio:

```
 Navegador ──HTTPS──▶ frontend (Caddy, archivos de Vite)        carpeta: frontend/
     │
     └──HTTPS──▶ backend (Django + gunicorn)  /api/...          carpeta: backend/
                     │  red privada de Railway (no sale a internet)
                     ├──▶ couchdb  (con Volume /opt/couchdb/data) carpeta: couchDB/
                     └──▶ omniroute (opcional, dictado con IA)
```

- **CouchDB no tiene dominio público.** Solo el backend la ve, por la red privada (`couchdb.railway.internal`).
- El navegador **nunca** habla con CouchDB ni con OmniRoute: todo pasa por Django.
- Railway **no usa** `docker-compose.yml`; ese archivo es solo para probar en tu PC lo mismo que corre en Railway.

## 1.1 Probar en tu PC con Docker (antes de Railway)

Levanta los mismos 3 servicios que en Railway, con datos aparte: no toca tu CouchDB de desarrollo ni tus `.env`. Necesita Docker Desktop abierto (y la virtualización activada en la BIOS).

1. Copia `.env.compose.example` como `.env.compose` y llena `SECRET_KEY`, `COUCHDB_ADMIN_PASSWORD` y `COUCHDB_PASSWORD` con valores generados (ver la sección 2). Son de prueba: no uses los mismos que en Railway.
2. Construye y levanta (la primera vez tarda unos minutos):
   ```bash
   docker compose --env-file .env.compose up -d --build
   ```
3. Revisa que el backend preparó CouchDB (tiene que decir `CouchDB listo.` y `Listening at: http://[::]:8000`):
   ```bash
   docker compose --env-file .env.compose logs backend
   ```
4. Crea el administrador de la app (te pide usuario, nombre y contraseña):
   ```bash
   docker compose --env-file .env.compose exec backend python manage.py crear_usuario
   ```
5. Abre <http://localhost:8080> y entra.
6. Para apagar: `docker compose --env-file .env.compose down`. Para borrar también los datos de prueba: agrega `-v`.

Si cambias código, vuelve a correr el paso 2 (`--build` reconstruye solo lo que cambió).

## 2. Cuentas y credenciales

> **Dónde anotarlas:** en un gestor de contraseñas compartido con el equipo (por ejemplo Bitwarden, que es gratis). **Nunca** en el repositorio, en el chat del grupo ni en un documento compartido. En Railway cada valor vive en la pestaña **Variables** del servicio indicado.

| # | Credencial | Dónde vive en Railway | Para qué sirve | Cómo cambiarla |
|---|---|---|---|---|
| 1 | **Administrador de CouchDB** (`COUCHDB_USER` / `COUCHDB_PASSWORD`) | servicio **couchdb** → Variables | Dueño total de la base. Solo lo usa `setup_couch`. | Ver [6.1](#61-contraseña-del-administrador-de-couchdb) |
| 2 | **casa_app** (`COUCHDB_PASSWORD`) | servicio **backend** → Variables | Cuenta con la que Django lee y escribe todos los días. Solo tiene acceso a las 4 bases `casa_*`. | Cambiar la variable y redeploy: `setup_couch` la actualiza solo al arrancar (si el backend tiene `COUCHDB_ADMIN_PASSWORD`) |
| 3 | **SECRET_KEY** de Django | servicio **backend** → Variables | Firma los tokens de sesión. | Cambiar la variable y redeploy. **Cierra la sesión de todos** (tienen que volver a entrar) |
| 4 | **Cuenta principal de la app** (primer Administrador) | dentro de CouchDB (`casa_usuarios`) | Entrar a la app y crear los demás usuarios. | Desde la misma app: menú de la cuenta → cambiar contraseña |
| 5 | Demás usuarios de la app | dentro de CouchDB (`casa_usuarios`) | Personal del hogar. | Un Administrador, en la pestaña **Usuarios** |
| 6 | **OmniRoute**: contraseña del panel + API key (opcional) | servicio **omniroute** / backend `OMNIROUTE_API_KEY` | Dictado con IA. | En el panel de OmniRoute; copiar la key nueva al backend |
| 7 | Tu cuenta de Railway y de GitHub | — | Acceso a todo lo anterior. | Activa la verificación en dos pasos en ambas |

Para generar contraseñas y la `SECRET_KEY` (en tu PC, con el venv activo):

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Genera **una distinta para cada credencial** (1, 2 y 3).

## 3. Pasos para desplegar

Antes: sube a GitHub la rama con estos cambios y en Railway conecta tu cuenta de GitHub.

### 3.1 Crear el proyecto y CouchDB
1. Railway → **New Project** → **Deploy from GitHub repo** → elige el repositorio.
2. Al **servicio** creado (la tarjeta dentro del proyecto, no el proyecto) ponle de nombre **`couchdb`**: clic en la tarjeta → pestaña **Settings** del servicio → nombre arriba. El nombre del proyecto puede ser cualquiera. El del servicio sí importa: las referencias como `${{couchdb.RAILWAY_PRIVATE_DOMAIN}}` lo usan.
3. **Settings → Source → Root Directory:** `couchDB`
4. **Variables:**
   ```
   COUCHDB_USER=admin
   COUCHDB_PASSWORD=<credencial 1>
   ```
5. Clic derecho sobre el servicio → **Attach Volume** → Mount path: `/opt/couchdb/data`. **Sin volumen, cada reinicio borra todos los datos.**
6. **No** generes dominio público para este servicio.

### 3.2 Backend

> **Orden:** backend y frontend se referencian entre sí (`${{frontend.RAILWAY_PUBLIC_DOMAIN}}` y `${{backend.RAILWAY_PUBLIC_DOMAIN}}`). Una referencia a un servicio que todavía no existe o no tiene dominio queda vacía. Lo más simple es crear **los dos servicios y generar sus dos dominios** (Settings → Networking → Generate Domain) **antes** de cargar las variables.

1. En el proyecto: **New → GitHub Repo** (el mismo repositorio). Nombre: **`backend`**.
2. **Root Directory:** `backend`
3. **Variables:**
   ```
   PORT=8080
   SECRET_KEY=<credencial 3>
   COUCHDB_URL=http://${{couchdb.RAILWAY_PRIVATE_DOMAIN}}:5984
   COUCHDB_USER=casa_app
   COUCHDB_PASSWORD=<credencial 2>
   COUCHDB_ADMIN_USER=${{couchdb.COUCHDB_USER}}
   COUCHDB_ADMIN_PASSWORD=${{couchdb.COUCHDB_PASSWORD}}
   ALLOWED_HOSTS=${{RAILWAY_PUBLIC_DOMAIN}},healthcheck.railway.app
   CORS_ALLOWED_ORIGINS=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
   ```
   `healthcheck.railway.app` es el nombre con el que llega el chequeo de salud de Railway; sin él, el deploy queda esperando.
   No pongas `DEBUG`: sin esa variable Django arranca en modo producción.
   Lo que va entre `${{ }}` lo completa Railway: son referencias a variables de otros servicios, así la contraseña del administrador se escribe una sola vez.
4. **Settings → Networking → Generate Domain**, con target port **8080** (el mismo de `PORT`). Te da algo como `backend-xxxx.up.railway.app`.
   Los cambios de configuración quedan **pendientes** hasta que pulses **Deploy / Apply changes** arriba en el lienzo: recién ahí se crea el dominio.
5. **Settings → Deploy → Healthcheck Path:** `/api/salud/`
6. Al arrancar, el backend corre `setup_couch` solo: crea las bases, el usuario `casa_app`, los permisos y los índices. Revisa en **Deploy Logs** que diga `CouchDB listo.`

### 3.3 Frontend
1. **New → GitHub Repo** (el mismo). Nombre: **`frontend`**. **Root Directory:** `frontend`
2. **Variables:**
   ```
   PORT=8080
   VITE_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api/
   ```
   Esta variable se usa **al construir**: si la cambias, tienes que hacer redeploy del frontend.
3. **Settings → Networking → Generate Domain**, con target port **8080**. Esa es la dirección que van a usar en el hogar.
4. Vuelve al **backend** y haz redeploy, para que `CORS_ALLOWED_ORIGINS` tome el dominio del frontend.

### 3.4 Primer Administrador de la app
CouchDB arranca vacía, así que hay que crear la cuenta principal (credencial 4). Con la [CLI de Railway](https://docs.railway.com/guides/cli):

```bash
npm install -g @railway/cli
railway login
railway link
railway ssh --service backend
```

Ya dentro del contenedor:

```bash
python manage.py crear_usuario
```

(El comando `railway ssh` exacto también aparece en el panel: clic derecho sobre el servicio backend → *Copy SSH Command*.)

### 3.5 (Recomendado) Quitar la clave de administrador del backend
Cuando `setup_couch` ya corrió, puedes borrar `COUCHDB_ADMIN_PASSWORD` de las variables del **backend**. Django sigue funcionando solo con `casa_app`, y si alguien llegara a vulnerar el backend no tendría la clave de administrador. Vuelve a agregarla cuando necesites correr `setup_couch` o rotar la contraseña de `casa_app`.

## 4. Revisión después de desplegar
- [ ] `https://<backend>/api/salud/` responde `{"ok": true}`.
- [ ] `https://<backend>/api/inventario/` sin sesión responde 401 (no muestra datos).
- [ ] Abres el frontend, entras con la cuenta principal y la consola del navegador (F12) no muestra errores de CORS ni de *Content Security Policy*.
- [ ] El servicio couchdb **no** tiene dominio público ni TCP Proxy.
- [ ] Si fallas el login 6 veces seguidas, te bloquea a ti pero otra persona desde otra red puede entrar. Si bloquea a todos, revisa `NUM_PROXIES` (por defecto 1).
- [ ] La cámara (lector de códigos) y el micrófono funcionan: necesitan HTTPS, y Railway lo da.

## 5. OmniRoute (dictado con IA): se puede dejar para después

**Sin OmniRoute la app funciona completa.** El dictado usa el reconocimiento de voz del navegador y el intérprete local (`logica/dictado.js`). Lo que suma la IA es entender mejor las frases desordenadas.

**Qué es:** OmniRoute es un "enrutador" de IA que se instala por separado. En su panel se conectan cuentas de proveedores de IA (por eso pide crear cuentas y vincularlas) y se arma un *combo* con varios modelos de respaldo; en este proyecto se llama `inventario-fallback`. Expone una API compatible con la de OpenAI.

**Qué necesita la app** (solo esto, en el servicio **backend**):
```
OMNIROUTE_URL=http://${{omniroute.RAILWAY_PRIVATE_DOMAIN}}:20128
OMNIROUTE_API_KEY=<API key creada en el panel de OmniRoute>
OMNIROUTE_MODEL=inventario-fallback
```

**Se puede cambiar cuando quieras.** Como la app solo usa esas 3 variables, puedes:
- agregarlo más adelante como otro servicio del proyecto (revisa su documentación para la imagen Docker, el volumen y la contraseña del panel; no le generes dominio público salvo para configurarlo, y protégelo con contraseña),
- correrlo en otra máquina,
- o reemplazarlo por cualquier API compatible con OpenAI (Groq, OpenRouter, la de OpenAI, etc.), cambiando `OMNIROUTE_URL`, la key y el modelo.

Cambiar las variables y hacer redeploy del backend basta; el frontend no se toca.

**Privacidad:** lo que se dicta se envía al proveedor de IA. Pide al personal que no dicte nombres de residentes (el campo "para" se completa a mano).

## 6. Mantenimiento

### 6.1 Contraseña del administrador de CouchDB
La variable `COUCHDB_PASSWORD` del servicio couchdb solo se aplica **la primera vez** (cuando el volumen está vacío). Para cambiarla después:
1. Desde el backend (`railway ssh --service backend`), con la clave actual:
   ```bash
   python -c "import os,requests; print(requests.put(os.environ['COUCHDB_URL']+'/_node/_local/_config/admins/'+os.environ['COUCHDB_ADMIN_USER'], json='NUEVA_CLAVE', auth=(os.environ['COUCHDB_ADMIN_USER'], os.environ['COUCHDB_ADMIN_PASSWORD'])).status_code)"
   ```
2. Pon la nueva en la variable `COUCHDB_PASSWORD` del servicio couchdb (para que coincida) y anótala en el gestor.

### 6.2 Respaldos
Los datos viven en el volumen de couchdb. Haz respaldos periódicos (por ejemplo cada semana) y guárdalos fuera de Railway:

```bash
railway ssh --service backend -- python manage.py exportar_couch > respaldo-AAAA-MM-DD.json
```

El archivo incluye los usuarios con el hash de su contraseña: guárdalo en un lugar privado. Para restaurar en una CouchDB vacía: `python manage.py setup_couch --datos respaldo.json`.

### 6.3 Costos (plan Hobby)
El plan incluye un monto de uso al mes; si el consumo lo supera, se cobra la diferencia. Revisa **Usage** en Railway la primera semana. Para gastar menos: `WEB_CONCURRENCY=1` en el backend (un solo proceso de gunicorn alcanza para el personal de un hogar) y no despliegues OmniRoute hasta que lo necesites.

### 6.4 Antes de cada despliegue
```powershell
.\pruebas.ps1
```
Y de vez en cuando revisa las dependencias: `pip install pip-audit` y luego `pip-audit -r backend/requirements.txt`, y en `frontend`, `npm audit`.
