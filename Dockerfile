FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server
COPY public ./public
RUN npm run build && test -s dist/models/hohner-club-i.glb

FROM node:24-alpine AS runtime
ARG APP_VERSION=development
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/app/data \
    APP_VERSION=${APP_VERSION}
WORKDIR /app
RUN addgroup -S soufflet && adduser -S soufflet -G soufflet
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
RUN mkdir -p /app/data && chown -R soufflet:soufflet /app
USER soufflet
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["npm", "start"]
