# Backend Django para Railway (Root Directory del servicio: backend)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# no correr como root
RUN useradd --create-home app && chown -R app:app /app
USER app

# Railway da el puerto en $PORT. "[::]" escucha en IPv6 e IPv4 (la red privada de Railway usa IPv6).
# Al arrancar: migraciones de Django (sqlite interno) y, si estan las variables del
# administrador de CouchDB, prepara las bases (setup_couch no rompe nada si ya existen).
CMD ["sh", "-c", "python manage.py migrate --noinput && if [ -n \"$COUCHDB_ADMIN_PASSWORD\" ]; then python manage.py setup_couch; fi && exec gunicorn core.wsgi:application --bind [::]:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --threads 4 --timeout 60 --access-logfile - --forwarded-allow-ips='*'"]
