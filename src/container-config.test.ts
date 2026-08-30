import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readRootFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const REQUIRED_BUILD_VALUES = [
  'VITE_AUTH0_DOMAIN',
  'VITE_AUTH0_CLIENT_ID',
  'VITE_AUTH0_CALLBACK',
  'VITE_AUTH0_AUDIENCE',
  'VITE_PLATFORM_API_ORIGIN',
] as const

/** The BuildKit secret id a value is mounted under: `VITE_AUTH0_DOMAIN` → `auth0_domain`. */
const secretId = (name: string) => name.replace(/^VITE_/, '').toLowerCase()

describe('container configuration — /health is not swallowed by the SPA fallback', () => {
  const config = readRootFile('nginx.conf')

  it('answers /health from its own exact-match text location, not from a file', () => {
    expect(config).toMatch(
      /location\s*=\s*\/health\s*\{[^}]*default_type\s+text\/plain;[^}]*return\s+200[^}]*\}/s,
    )
    expect(config).not.toMatch(/location\s*=\s*\/health\s*\{[^}]*add_header\s+Content-Type/s)
  })

  it('falls back to the application shell for unknown paths', () => {
    expect(config).toMatch(/location\s+\/\s*\{[^}]*try_files[^;]*\/index\.html;[^}]*\}/s)
  })

  it('does not speak HTTPS and holds no certificate', () => {
    expect(config).not.toMatch(/ssl_certificate|listen\s+443/)
  })

  it('listens on both loopback families, so the health check can reach it', () => {
    expect(config).toMatch(/listen\s+80;/)
    expect(config).toMatch(/listen\s+\[::\]:80;/)
  })
})

describe('container configuration — the runtime image carries no toolchain', () => {
  const dockerfile = readRootFile('Dockerfile')

  it('builds in a Node stage and serves from an nginx stage', () => {
    expect(dockerfile).toContain('FROM node:22-alpine AS build')
    expect(dockerfile).toContain('FROM nginx:1.29-alpine AS runtime')
  })

  it('copies the manifests first so a content-only change reuses the install layer', () => {
    const manifests = dockerfile.indexOf('COPY package.json package-lock.json ./')
    const sources = dockerfile.indexOf('COPY . .')

    expect(manifests).toBeGreaterThan(-1)
    expect(sources).toBeGreaterThan(manifests)
  })

  /**
   * The correction from the 2026-08-27 exposure. Build arguments were the wrong
   * carrier twice over: BuildKit records them in SLSA provenance, and the
   * `${NAME:?}` guards that enforced them were expanded into the `RUN` line
   * BuildKit echoes, so the values were printed in the public build log.
   *
   * A secret mount is neither. It exists only for the one `RUN` that mounts it,
   * never becomes a layer, and never appears in provenance or in the echoed
   * command — the command names a path, and the value lives behind it.
   */
  it('takes no build argument for any required value, because provenance would record one', () => {
    expect(dockerfile).not.toMatch(/ARG\s+VITE_AUTH0_/)
    expect(dockerfile).not.toMatch(/ARG\s+VITE_PLATFORM_API_ORIGIN/)
  })

  it('reads every required value from a secret mount on the build step', () => {
    const buildCommand = dockerfile.slice(dockerfile.indexOf('\nRUN --mount=type=secret'))

    expect(buildCommand).toContain('npm run build')

    for (const name of REQUIRED_BUILD_VALUES) {
      expect(buildCommand).toContain(`type=secret,id=${secretId(name)}`)
      expect(buildCommand).toContain(`/run/secrets/${secretId(name)}`)
    }
  })

  /**
   * The guard refuses without expanding a value, because BuildKit prints the
   * resolved `RUN` line. It tests each mounted file and names only the public
   * environment variable when configuration is absent.
   */
  it('refuses each missing or empty value before the bundle is built, without expanding it', () => {
    const buildCommand = dockerfile.slice(dockerfile.indexOf('\nRUN --mount=type=secret'))
    const build = buildCommand.indexOf('npm run build')

    for (const name of REQUIRED_BUILD_VALUES) {
      const guard = buildCommand.indexOf(`-s /run/secrets/${secretId(name)}`)

      expect(guard).toBeGreaterThan(-1)
      expect(guard).toBeLessThan(build)
      expect(buildCommand).toContain(`${name} is required`)
    }

    expect(buildCommand).not.toMatch(/\$\{VITE_AUTH0_[A-Z_]*:\?/)
    expect(buildCommand).not.toMatch(/\$\{VITE_PLATFORM_API_ORIGIN:\?/)
    expect(buildCommand).not.toMatch(/echo[^\n]*\$\(cat \/run\/secrets/)
  })

  it('keeps every required value out of the runtime stage', () => {
    const runtimeStage = dockerfile.slice(dockerfile.indexOf('FROM nginx:1.29-alpine AS runtime'))

    expect(runtimeStage).not.toMatch(
      /VITE_AUTH0_|VITE_PLATFORM_API_ORIGIN|\bARG\b|\bENV\b|\/run\/secrets/,
    )
  })

  it('carries only the built bundle and the config into the runtime stage', () => {
    expect(dockerfile).toContain('COPY --from=build /app/dist /usr/share/nginx/html')
    expect(dockerfile).toContain('COPY nginx.conf /etc/nginx/conf.d/default.conf')
  })
})

describe('container configuration — the build context', () => {
  it('excludes local dependencies, build output and repository metadata', () => {
    const ignored = readRootFile('.dockerignore')
      .split(/\r?\n/)
      .map((line) => line.trim())

    expect(ignored).toEqual(expect.arrayContaining(['node_modules', 'dist', '.git', 'coverage']))
  })
})
