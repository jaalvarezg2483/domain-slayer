# Railway / Docker: `npm install` (no `npm ci`) evita lockfiles v1/v3 o entradas legacy rotas.
# better-sqlite3 requiere toolchain nativa en la imagen slim.

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

# Lock v1 + alias «*-cjs» rompen npm 10 en Linux; instalación limpia en la imagen.
RUN rm -f package-lock.json \
  && npm install --legacy-peer-deps \
  && npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "apps/backend/dist/main.js"]
