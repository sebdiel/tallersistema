# PWA Angular servida por Caddy (HTTPS automático) — Iteración 4

# 1) Compilación de la PWA
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

# 2) Servidor web: archivos estáticos + proxy /api al backend
FROM caddy:2.8-alpine
COPY --from=build /app/dist/frontend/browser /srv
COPY Caddyfile /etc/caddy/Caddyfile
