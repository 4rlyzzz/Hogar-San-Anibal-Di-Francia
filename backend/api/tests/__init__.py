import logging

# las pruebas simulan fallas de CouchDB a proposito: sus errores en el log solo ensucian la salida
logging.disable(logging.CRITICAL)
