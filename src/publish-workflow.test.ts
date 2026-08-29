import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raw = readFileSync(resolve(process.cwd(), '.github/workflows/publish-image.yml'), 'utf8')

const workflow = raw
  .split(/\r?\n/)
  .filter((line) => !/^\s*#/.test(line))
  .join('\n')

const buildStep = workflow.match(
  /uses: docker\/build-push-action@v\d+[\s\S]*?(?=\n {6}- |\n {2}\S|$)/,
)?.[0]

const validationStep = workflow.match(
  /- name: Validate build configuration[\s\S]*?(?=\n {6}- |\n {2}\S|$)/,
)?.[0]

const deployJob = workflow.match(/\n {2}deploy:\n[\s\S]*$/)?.[0]

const AUTH0_VARIABLES = [
  'VITE_AUTH0_DOMAIN',
  'VITE_AUTH0_CLIENT_ID',
  'VITE_AUTH0_CALLBACK',
] as const

const PREVIEW_IDENTITY_VARIABLES = [
  'VITE_PREVIEW_IDENTITY_PROVIDER',
  'VITE_PREVIEW_IDENTITY_SUBJECT',
] as const

/**
 * Everything Vite must have at build time. The preview mapping (#39) travels the
 * delivery path #38 settled rather than a second one of its own.
 */
const REQUIRED_BUILD_VALUES = [...AUTH0_VARIABLES, ...PREVIEW_IDENTITY_VARIABLES] as const

/** The BuildKit secret id a value is mounted under: `VITE_AUTH0_DOMAIN` → `auth0_domain`. */
const secretId = (name: string) => name.replace(/^VITE_/, '').toLowerCase()

describe('publish workflow — when it runs', () => {
  it('runs on a push to main and on nothing else', () => {
    expect(workflow).toMatch(/on:\s*\n\s+push:\s*\n\s+branches:\s*\[main\]/)
  })

  it('never runs on a pull request, so a fork cannot reach the registry', () => {
    expect(workflow).not.toMatch(/^\s*pull_request(_target)?:/m)
  })

  it('is not a fifth pull-request check: ci.yml is untouched', () => {
    const ci = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8')

    expect(ci).not.toContain('ghcr.io')
    expect(ci).not.toContain('docker')
  })
})

describe('publish workflow — how it authenticates', () => {
  it('declares packages: write and narrows the rest', () => {
    expect(workflow).toMatch(/permissions:\s*\n(?:\s+[^\n]+\n)*?\s+packages:\s*write/)
    expect(workflow).toMatch(/permissions:\s*\n(?:\s+[^\n]+\n)*?\s+contents:\s*read/)
  })

  /**
   * #28's registry guarantee, kept but stated precisely. The registry
   * credential is the built-in token and nothing else — no personal access
   * token, no stored registry login. The Auth0 and preview-identity entries
   * are configuration carried through `secrets` for its masking, and they
   * authenticate nothing. VPS_HOST / VPS_SSH_KEY are the named deploy
   * secrets #94 requires; they are not a registry login.
   */
  it('uses the built-in token and no long-lived registry credential', () => {
    expect(workflow).toContain('password: ${{ secrets.GITHUB_TOKEN }}')

    const secretsUsed = [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1])
    const credentials = [...new Set(secretsUsed)].filter(
      (name) => !REQUIRED_BUILD_VALUES.includes(name as (typeof REQUIRED_BUILD_VALUES)[number]),
    )

    expect(credentials.sort()).toEqual(['GITHUB_TOKEN', 'VPS_HOST', 'VPS_SSH_KEY'])
  })
})

describe('publish workflow — what it publishes', () => {
  it('pushes an immutable commit tag alongside latest', () => {
    expect(buildStep).toBeDefined()
    expect(buildStep).toContain('push: true')
    expect(buildStep).toContain('${{ env.IMAGE }}:${{ github.sha }}')
    expect(buildStep).toContain('${{ env.IMAGE }}:latest')
  })

  it('publishes to the reference kolonie-infra pulls from', () => {
    expect(workflow).toMatch(/IMAGE:\s*ghcr\.io\/kolonie-ai\/kolonie-workplace\s*$/m)
  })

  it('reuses build layers so a content-only commit does not rebuild the toolchain', () => {
    expect(buildStep).toContain('cache-from: type=gha')
    expect(buildStep).toContain('cache-to: type=gha,mode=max')
  })
})

describe('publish workflow — build configuration', () => {
  /**
   * The correction from the 2026-08-27 exposure. The first implementation read
   * the three Auth0 values from `vars` and handed them to `build-push-action` as
   * `build-args`. Actions prints a step's `env:` block and every action input
   * verbatim, and repository *variables* are not masked — only secrets are — so
   * the values appeared in the public job log and, because buildx records build
   * arguments in SLSA provenance, in a published attestation blob.
   *
   * Nothing about a value's sensitivity fixes that: the masking is what differs.
   * So delivery moves to `secrets`, which the runner redacts everywhere it would
   * otherwise print, and to BuildKit secret mounts, which are never build
   * arguments and are therefore never recorded in provenance.
   *
   * The preview identity mapping (#39) travels the same path. It is held to
   * every one of these properties, because a provider and a subject identify a
   * real person's login at least as much as a tenant host names a tenant.
   */
  it('never reads any required value from unmasked repository variables', () => {
    for (const name of REQUIRED_BUILD_VALUES) {
      expect(workflow, `${name} must not be read from the unmasked vars context`).not.toContain(
        `vars.${name}`,
      )
    }

    expect(workflow).not.toMatch(/vars\.VITE_/)
  })

  it('never passes a value as a build argument, which provenance would record', () => {
    expect(buildStep).toBeDefined()
    expect(buildStep).not.toMatch(/build-args:[\s\S]*VITE_/)
    expect(workflow).not.toMatch(/--build-arg/)
  })

  it('hands every required value to the build as a masked BuildKit secret', () => {
    expect(buildStep).toBeDefined()

    for (const name of REQUIRED_BUILD_VALUES) {
      expect(buildStep).toContain(`${secretId(name)}=\${{ secrets.${name} }}`)
    }

    expect(buildStep).toMatch(/secrets:\s*\|/)
  })

  it('keeps build arguments and environment out of the attached provenance', () => {
    expect(buildStep).toMatch(/provenance:\s*(false|mode=min)/)
  })

  it('validates every required value before login and push, through masked env only', () => {
    expect(validationStep).toBeDefined()

    const validation = workflow.indexOf('- name: Validate build configuration')
    const login = workflow.indexOf('uses: docker/login-action')
    const build = workflow.indexOf('uses: docker/build-push-action')

    expect(validation).toBeGreaterThan(-1)
    expect(validation).toBeLessThan(login)
    expect(validation).toBeLessThan(build)

    for (const name of REQUIRED_BUILD_VALUES) {
      expect(validationStep).toContain(`${name}: \${{ secrets.${name} }}`)
      expect(validationStep).toContain(`-z "\${${name}}"`)
    }
  })

  it('does not copy build configuration into workflow-wide or runtime environment', () => {
    const globalEnvironment = workflow.match(/\nenv:\s*\n[\s\S]*?(?=\n\S)/)?.[0] ?? ''

    expect(globalEnvironment).not.toContain('VITE_')
    expect(workflow).not.toMatch(/labels:[\s\S]*VITE_/)
  })
})

describe('publish workflow — rejection: a failed build must publish nothing', () => {
  it('never softens a failure, so a red step cannot reach the push', () => {
    expect(workflow).not.toMatch(/continue-on-error/)
    expect(workflow).not.toMatch(/\|\|\s*true/)
  })

  it('pushes from the build step itself, so there is no push after a failed build', () => {
    expect(buildStep).toContain('push: true')
    expect(workflow).not.toMatch(/run:\s*docker push/)
  })
})

describe('publish workflow — it publishes and then deploys that SHA', () => {
  it('calls infra deploy after a successful publish, never on a red build', () => {
    expect(deployJob).toBeDefined()
    expect(deployJob).toMatch(/needs:\s*publish\b/)
    expect(deployJob).toContain('uses: Kolonie-AI/kolonie-infra/.github/workflows/deploy.yml@main')
    expect(workflow).not.toMatch(/continue-on-error/)
  })

  it('deploys only workplace at the commit SHA, never latest and never another service', () => {
    expect(deployJob).toBeDefined()
    expect(deployJob).toMatch(/service:\s*workplace\s*$/m)
    expect(deployJob).toContain('version: ${{ github.sha }}')
    expect(deployJob).not.toMatch(/version:\s*['"]?latest['"]?/)
    expect(deployJob).not.toMatch(/service:\s*(api|website|all|verifier-runner)/)
  })

  it('names the two host secrets and does not inherit the rest', () => {
    expect(deployJob).toBeDefined()
    expect(deployJob).toContain('VPS_HOST: ${{ secrets.VPS_HOST }}')
    expect(deployJob).toContain('VPS_SSH_KEY: ${{ secrets.VPS_SSH_KEY }}')
    expect(workflow).not.toMatch(/secrets:\s*inherit/)
  })
})
