# Operator can point NODE_IMAGE to a trusted Tencent TCR mirror of this image.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN npm install -g pnpm@11.19.0 --registry=https://registry.npmmirror.com
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY shared ./shared
COPY server ./server
COPY scripts ./scripts
COPY tests ./tests
COPY db ./db
RUN pnpm build
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
RUN npm install -g pnpm@11.19.0 --registry=https://registry.npmmirror.com
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production PORT=8080
USER node
EXPOSE 8080
CMD ["node","build/server/index.js"]
