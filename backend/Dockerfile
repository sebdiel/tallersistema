# API NestJS — imagen de producción (Iteración 4)

# 1) Compilación
FROM node:20-alpine AS build
# Herramientas para compilar bcrypt si no hay binario precompilado para Alpine.
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# 2) Ejecución (solo lo necesario, usuario sin privilegios)
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
# Las migraciones pendientes se aplican solas al arrancar (DB_SYNC=false).
CMD ["node", "dist/main"]
