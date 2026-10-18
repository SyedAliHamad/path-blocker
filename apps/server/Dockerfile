# Built from the repository root, because the server imports workspace
# packages and npm needs the whole workspace to resolve the lockfile.
#   fly launch --no-deploy --dockerfile apps/server/Dockerfile
FROM node:24-alpine AS build
WORKDIR /app

# The whole repo is copied rather than a hand-picked subset: npm ci validates
# package-lock.json against every workspace the root package.json declares, and
# omitting one makes it fail in a way that is tedious to diagnose. .dockerignore
# keeps this cheap, and nothing from this stage reaches the final image.
COPY . .
RUN npm ci --ignore-scripts
RUN npm run build --workspace @pb/server

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

# Everything is bundled into this one file, dependencies included, so the
# runtime image carries no node_modules at all.
COPY --from=build /app/apps/server/dist ./dist

EXPOSE 8787
CMD ["node", "dist/server.cjs"]
