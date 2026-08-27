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

# The Auth0 SPA configuration from #2 and the preview identity mapping from #39
# are read by Vite while this stage runs, so they have to arrive here and
# nowhere else.
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
# There is deliberately no default, for any of the five. Without the tenant
# configuration `npm run build` still succeeds and produces a bundle carrying
# the `MissingAuth0Configuration` refusal; without the preview mapping it
# produces one carrying `MissingPreviewIdentityConfiguration`. Either way the
# application throws before it mounts — a green build and a dead page, which is
# the failure #38 exists to remove and which #39 must not reintroduce.
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
    --mount=type=secret,id=preview_identity_provider \
    --mount=type=secret,id=preview_identity_subject \
    test -s /run/secrets/auth0_domain \
      || { echo "VITE_AUTH0_DOMAIN is required to build the workplace" >&2; exit 1; }; \
    test -s /run/secrets/auth0_client_id \
      || { echo "VITE_AUTH0_CLIENT_ID is required to build the workplace" >&2; exit 1; }; \
    test -s /run/secrets/auth0_callback \
      || { echo "VITE_AUTH0_CALLBACK is required to build the workplace" >&2; exit 1; }; \
    test -s /run/secrets/preview_identity_provider \
      || { echo "VITE_PREVIEW_IDENTITY_PROVIDER is required to build the workplace" >&2; exit 1; }; \
    test -s /run/secrets/preview_identity_subject \
      || { echo "VITE_PREVIEW_IDENTITY_SUBJECT is required to build the workplace" >&2; exit 1; }; \
    export VITE_AUTH0_DOMAIN="$(cat /run/secrets/auth0_domain)"; \
    export VITE_AUTH0_CLIENT_ID="$(cat /run/secrets/auth0_client_id)"; \
    export VITE_AUTH0_CALLBACK="$(cat /run/secrets/auth0_callback)"; \
    export VITE_PREVIEW_IDENTITY_PROVIDER="$(cat /run/secrets/preview_identity_provider)"; \
    export VITE_PREVIEW_IDENTITY_SUBJECT="$(cat /run/secrets/preview_identity_subject)"; \
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
