"""Da permiso a la app para subir los respaldos al Google Drive del Hogar. Se corre UNA vez, en tu PC.

    python manage.py autorizar_drive --credenciales C:\\Users\\...\\client_secret_XXXX.json

--credenciales: el JSON que se descargo al crear el cliente "App de escritorio" en Google Cloud
(sin el, usa DRIVE_CLIENT_ID y DRIVE_CLIENT_SECRET del backend/.env).

Abre el navegador: entra con la cuenta de Google del Hogar y acepta. Al final muestra las tres
variables (DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET, DRIVE_REFRESH_TOKEN) para el servicio de respaldos
en Railway. Son secretas: no las subas al repositorio ni las pegues en un chat.
"""
import base64
import hashlib
import json
import secrets
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlparse

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api.respaldo import PERMISO, URL_TOKEN

URL_PERMISO = 'https://accounts.google.com/o/oauth2/v2/auth'
ESPERA = 300  # segundos para aceptar en el navegador


def leer_credenciales(ruta):
    """(client_id, client_secret) del JSON de Google Cloud o de las variables."""
    if not ruta:
        return settings.DRIVE_CLIENT_ID, settings.DRIVE_CLIENT_SECRET
    try:
        with open(ruta, encoding='utf-8') as archivo:
            datos = json.load(archivo)
    except (OSError, ValueError) as e:
        raise CommandError(f'No se pudo leer {ruta}: {e}')
    cliente = datos.get('installed') or datos.get('web') or {}
    if 'web' in datos:
        raise CommandError('Ese cliente es de tipo "Aplicación web": crea uno de tipo "App de escritorio"')
    return cliente.get('client_id', ''), cliente.get('client_secret', '')


class Command(BaseCommand):
    help = 'Da permiso a la app para subir respaldos al Google Drive (se corre una vez, en tu PC)'

    def add_arguments(self, parser):
        parser.add_argument('--credenciales', help='JSON del cliente "App de escritorio" descargado de Google Cloud')
        parser.add_argument('--sin-navegador', action='store_true', help='Solo muestra el enlace (no abre el navegador)')

    def handle(self, *args, credenciales=None, sin_navegador=False, **opciones):
        client_id, client_secret = leer_credenciales(credenciales)
        if not client_id or not client_secret:
            raise CommandError('Falta la credencial: usa --credenciales <archivo.json> o pon DRIVE_CLIENT_ID y DRIVE_CLIENT_SECRET en backend/.env')

        # PKCE y state: el codigo solo sirve para este pedido
        verificador = secrets.token_urlsafe(64)
        reto = base64.urlsafe_b64encode(hashlib.sha256(verificador.encode()).digest()).rstrip(b'=').decode()
        estado = secrets.token_urlsafe(16)
        recibido = {}

        class Respuesta(BaseHTTPRequestHandler):
            def do_GET(self):
                consulta = parse_qs(urlparse(self.path).query)
                if 'code' not in consulta and 'error' not in consulta:
                    self.send_response(404)
                    self.end_headers()
                    return
                recibido.update({k: v[0] for k, v in consulta.items()})
                listo = 'code' in consulta and consulta.get('state', [''])[0] == estado
                texto = ('Listo: ya puedes cerrar esta pestaña y volver a la consola.' if listo
                         else 'No se dio el permiso. Vuelve a la consola.')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.end_headers()
                self.wfile.write(f'<!doctype html><meta charset="utf-8"><p style="font:18px sans-serif;margin:40px">{texto}</p>'.encode())

            def log_message(self, *args):
                pass

        # solo en esta PC (127.0.0.1), en un puerto libre
        servidor = HTTPServer(('127.0.0.1', 0), Respuesta)
        servidor.timeout = ESPERA
        redireccion = f'http://127.0.0.1:{servidor.server_port}'
        enlace = f'{URL_PERMISO}?' + urlencode({
            'client_id': client_id, 'redirect_uri': redireccion, 'response_type': 'code', 'scope': PERMISO,
            # offline + consent: Google entrega el refresh token (el que no vence)
            'access_type': 'offline', 'prompt': 'consent',
            'code_challenge': reto, 'code_challenge_method': 'S256', 'state': estado,
        })

        self.stdout.write('Entra con la cuenta de Google del Hogar y acepta el permiso.')
        self.stdout.write(f'Si el navegador no se abre solo, copia este enlace:\n\n{enlace}\n')
        if not sin_navegador:
            webbrowser.open(enlace)
        self.stdout.write(f'Esperando (hasta {ESPERA // 60} minutos)...')
        servidor.handle_request()
        servidor.server_close()

        if recibido.get('error'):
            raise CommandError(f'Google no dio el permiso: {recibido["error"]}')
        if not recibido.get('code'):
            raise CommandError('Se acabo el tiempo sin respuesta del navegador: vuelve a intentarlo')
        if recibido.get('state') != estado:
            raise CommandError('La respuesta no corresponde a este pedido: vuelve a intentarlo')

        r = requests.post(URL_TOKEN, data={
            'client_id': client_id, 'client_secret': client_secret, 'code': recibido['code'],
            'code_verifier': verificador, 'grant_type': 'authorization_code', 'redirect_uri': redireccion,
        }, timeout=60)
        if r.status_code != 200:
            raise CommandError(f'Google rechazo el codigo ({r.status_code}): {r.text[:300]}')
        datos = r.json()
        if not datos.get('refresh_token'):
            raise CommandError('Google no entrego el refresh token: quita el permiso en myaccount.google.com/permissions y vuelve a correr esto')
        if PERMISO not in datos.get('scope', ''):
            raise CommandError('No se dio el permiso de Drive: vuelve a intentarlo y marca la casilla de Google Drive')

        self.stdout.write(self.style.SUCCESS('\nPermiso dado. Estas son las variables del servicio de respaldos en Railway'))
        self.stdout.write('(y de tu backend/.env si quieres probar en tu PC). Son secretas: no las compartas.\n')
        self.stdout.write(f'DRIVE_CLIENT_ID={client_id}')
        self.stdout.write(f'DRIVE_CLIENT_SECRET={client_secret}')
        self.stdout.write(f'DRIVE_REFRESH_TOKEN={datos["refresh_token"]}')
