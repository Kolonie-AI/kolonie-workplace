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

# The Auth0 SPA configuration from #2 is read by Vite while this stage runs, so
# it has to arrive here and nowhere else. The three `ARG`s are declared inside
# the build stage rather than before the first `FROM`, because an argument
# declared there would be global and reachable from the runtime stage.
#
# There is deliberately no default. Without them `npm run build` still succeeds
# and produces a bundle carrying the `MissingAuth0Configuration` refusal, which
# throws before the application mounts — a green build and a dead page, which is
# the failure #38 exists to remove.
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_CALLBACK

# `${NAME:?message}` is what moves that refusal from the browser to here: an
# unset or empty argument fails this `RUN` before `npm run build` is reached,
# and a failed stage produces no image to tag or push. `:` expands its operands
# and prints nothing, so a configured value never enters the build log.
RUN : "${VITE_AUTH0_DOMAIN:?VITE_AUTH0_DOMAIN is required to build the workplace}" \
    && : "${VITE_AUTH0_CLIENT_ID:?VITE_AUTH0_CLIENT_ID is required to build the workplace}" \
    && : "${VITE_AUTH0_CALLBACK:?VITE_AUTH0_CALLBACK is required to build the workplace}" \
    && npm run build

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
