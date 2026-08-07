FROM node:20.19.1-alpine3.21 AS dependencies
WORKDIR /app
COPY package*.json ./
COPY platform/package.json ./platform/package.json
RUN npm ci --workspace platform --include-workspace-root=false

FROM dependencies AS build
COPY platform ./platform
WORKDIR /app/platform
RUN npm run build

FROM node:20.19.1-alpine3.21 AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/platform/.next/standalone ./
COPY --from=build --chown=app:app /app/platform/.next/static ./platform/.next/static
USER app
EXPOSE 3000
CMD ["node", "platform/server.js"]
