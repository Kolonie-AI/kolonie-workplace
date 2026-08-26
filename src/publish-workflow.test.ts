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

  it('uses the built-in token and no long-lived credential', () => {
    expect(workflow).toContain('password: ${{ secrets.GITHUB_TOKEN }}')

    const secretsUsed = [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1])

    expect([...new Set(secretsUsed)]).toEqual(['GITHUB_TOKEN'])
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

describe('publish workflow — it publishes and does not deploy', () => {
  it('calls no deploy workflow and holds no host credential', () => {
    expect(workflow).not.toContain('kolonie-infra/.github/workflows/deploy.yml')
    expect(workflow).not.toMatch(/VPS_HOST|VPS_SSH_KEY/)
  })
})
