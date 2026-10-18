# The server bundles its workspace dependencies, so the image needs the whole
# monorepo to build but ships only the bundle.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN npm ci --ignore-scripts --workspace @pb/server --include-workspace-root

RUN npm run build --workspace @pb/server

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/server/dist ./dist

EXPOSE 8787
CMD ["node", "dist/server.js"]
