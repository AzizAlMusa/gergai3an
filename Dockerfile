# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm ci --prefix client && npm ci --prefix server --omit=dev

COPY client ./client
COPY server ./server
COPY package*.json ./

RUN npm run build --prefix client

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY package*.json ./

EXPOSE 3000
CMD ["node", "server/src/index.js"]
