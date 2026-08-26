import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readRootFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

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
