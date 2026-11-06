# CouchDB para Railway (Root Directory del servicio: couchDB)
# Montar un Volume en /opt/couchdb/data: sin eso, cada reinicio borra los datos.
# La cuenta de administrador sale de las variables COUCHDB_USER y COUCHDB_PASSWORD del servicio.
FROM couchdb:3.4.2
COPY railway.ini /opt/couchdb/etc/local.d/railway.ini
