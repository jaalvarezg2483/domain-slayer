# Contexto: raíz del repositorio
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build:all

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/
COPY --from=build /app/packages ./packages
COPY --from=build /app/services ./services
EXPOSE 3000
USER node
CMD ["node", "apps/backend/dist/main.js"]
