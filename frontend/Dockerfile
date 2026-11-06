# Frontend para Railway (Root Directory del servicio: frontend)
# 1) construye con Vite  2) sirve los archivos estaticos con Caddy

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Railway pasa la variable del servicio como argumento de build (tiene que existir antes de construir)
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "Falta VITE_API_URL (ej. https://backend.up.railway.app/api/)" && exit 1)
RUN npm run build

FROM caddy:2.8.4-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
