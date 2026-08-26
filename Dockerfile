# Build the workplace bundle, then serve it from nginx. Two stages, because the
# runtime image has no reason to contain node_modules or a build toolchain.
#
# This follows `kolonie-website`'s image rather than inventing a second shape.
# The difference that matters is in `nginx.conf`: the workplace is a
# single-page application, so unknown paths fall back to the shell.

FROM node:22-alpine AS build
WORKDIR /app

# The manifests first, so a content-only change reuses the install layer.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS runtime

# The default config is replaced, because nginx's own would answer `/health`
# with a 404 and every unknown path with its default error page.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# TLS terminates at Traefik (kolonie-infra#241), which is the only thing that
# talks to this container. Nothing here speaks HTTPS and no certificate is
# baked in.
#
# The probe asks for `/health` rather than `/`, so a broken bundle cannot pass
# it: `/` is served from a file and `/health` is not. `localhost` resolves to
# the IPv6 loopback first under musl, which is why `nginx.conf` listens on both
# families — without that line this probe fails with `Connection refused` and
# the container never leaves `starting`.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1
