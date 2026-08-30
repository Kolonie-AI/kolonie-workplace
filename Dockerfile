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

# The complete live workplace configuration is read by Vite while this stage
# runs, so it has to arrive here and nowhere else.
#
# **Not as build arguments.** The first attempt at #38 used `ARG`, and it leaked
# the values twice: BuildKit records every build argument in the SLSA provenance
# it attaches to the published image, and the `${NAME:?}` guards that enforced
# them were expanded into the `RUN` line BuildKit echoes into the public build
# log. Neither is about how sensitive the values are; both are about where a
# build argument is written down.
#
# A secret mount is written down in neither. It exists only for the duration of
# this one `RUN`, never becomes a layer, never reaches provenance, and the
# echoed command names a path rather than a value.
#
# There is deliberately no default for the five live values. Without one,
# `npm run build` would still produce a bundle that fails only in the browser —
# a green build and a dead page.
#
# `-s` is what refuses that here: true only for a file that exists and is not
# empty, so a missing mount and an empty value fail alike, and the message names
# the variable — which is public — rather than what is in it.
#
# The values are exported into the environment of `npm run build` only, in the
# same shell, so Vite reads them exactly as it reads a local `.env.local`. They
# are never echoed, never written to a file in the image, and the next stage
# copies only `dist/`.
RUN --mount=type=secret,id=auth0_domain \
    --mount=type=secret,id=auth0_client_id \
    --mount=type=secret,id=auth0_callback \
    --mount=type=secret,id=auth0_audience \
    --mount=type=secret,id=platform_api_origin \
    test -s /run/secrets/auth0_domain \
      || { echo "VITE_AUTH0_DOMAIN is required to build the workplace" >&2; exit 1; }; \
    test -s /run/secrets/auth0_client_id \
      || { echo "VITE_AUTH0_CLIENT_ID is required to build the workplace" >&2; exit 1; }; \
    test -s /run/secrets/auth0_callback \
      || { echo "VITE_AUTH0_CALLBACK is required to build the workplace" >&2; exit 1; }; \
    test -s /run/secrets/auth0_audience \
      || { echo "VITE_AUTH0_AUDIENCE is required to build the workplace" >&2; exit 1; }; \
    test -s /run/secrets/platform_api_origin \
      || { echo "VITE_PLATFORM_API_ORIGIN is required to build the workplace" >&2; exit 1; }; \
    export VITE_AUTH0_DOMAIN="$(cat /run/secrets/auth0_domain)"; \
    export VITE_AUTH0_CLIENT_ID="$(cat /run/secrets/auth0_client_id)"; \
    export VITE_AUTH0_CALLBACK="$(cat /run/secrets/auth0_callback)"; \
    export VITE_AUTH0_AUDIENCE="$(cat /run/secrets/auth0_audience)"; \
    export VITE_PLATFORM_API_ORIGIN="$(cat /run/secrets/platform_api_origin)"; \
    npm run build

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
