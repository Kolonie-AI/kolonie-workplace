import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chooseWorkplaceSession } from '@/session/provide-session'
import { MissingPreviewIdentityConfiguration } from '@/session/preview-identity'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const CONFIGURED = {
  VITE_AUTH0_DOMAIN: 'configured-domain',
  VITE_AUTH0_CLIENT_ID: 'configured-client-id',
  VITE_AUTH0_CALLBACK: 'https://workplace.example.invalid/sign-in/callback',
  VITE_PREVIEW_IDENTITY_PROVIDER: 'configured-provider',
  VITE_PREVIEW_IDENTITY_SUBJECT: 'configured-subject',
} as const

describe('application composition carries the preview mapping to the directory alone', () => {
  it('composes a session when both the tenant and the mapping are configured', () => {
    expect(chooseWorkplaceSession({ env: CONFIGURED })).toBeDefined()
  })

  it('refuses to start when the preview mapping is missing entirely', () => {
    const { VITE_PREVIEW_IDENTITY_PROVIDER, VITE_PREVIEW_IDENTITY_SUBJECT, ...rest } =
      CONFIGURED

    expect(VITE_PREVIEW_IDENTITY_PROVIDER).toBeDefined()
    expect(VITE_PREVIEW_IDENTITY_SUBJECT).toBeDefined()
    expect(() => chooseWorkplaceSession({ env: rest })).toThrow(
      MissingPreviewIdentityConfiguration,
    )
  })

  it.each([
    'VITE_PREVIEW_IDENTITY_PROVIDER',
    'VITE_PREVIEW_IDENTITY_SUBJECT',
  ])('refuses to start on a partial mapping missing %s', (missing) => {
    const partial: Record<string, string> = { ...CONFIGURED }
    delete partial[missing]

    expect(() => chooseWorkplaceSession({ env: partial })).toThrow(
      MissingPreviewIdentityConfiguration,
    )
  })
})

/**
 * The adapter is isolated behind `HumanDirectory`. A board, sidebar, Kanban,
 * List or detail component that learned about preview identity configuration
 * would be a component that has to be revisited when the real directory lands,
 * which is exactly what the port exists to prevent.
 */
describe('no board or shell component learns about the preview mapping', () => {
  const MUST_STAY_CLEAN = [
    'src/App.vue',
    'src/shell/AppShell.vue',
    'src/shell/views.ts',
    'src/session/SessionGate.vue',
    'src/session/SignedOutView.vue',
    'src/session/SignedInHuman.vue',
    'src/boards/BoardList.vue',
    'src/boards/use-board-list.ts',
    'src/kanban/KanbanBoard.vue',
    'src/kanban/KanbanCard.vue',
    'src/list/ListView.vue',
    'src/list/ListRow.vue',
    'src/detail/DetailPane.vue',
    'src/detail/use-item-detail.ts',
    'src/items/use-board-items.ts',
    'src/session/workplace-session.ts',
    'src/session/human-directory.ts',
    'src/gateway/fixture-task-gateway.ts',
  ] as const

  it('names no preview identity variable outside the session adapter', () => {
    for (const path of MUST_STAY_CLEAN) {
      expect(read(path), `${path} must not know about preview identity`).not.toMatch(
        /VITE_PREVIEW_IDENTITY|preview-identity/,
      )
    }
  })

  it('keeps the port interface free of it, so a real directory replaces one file', () => {
    expect(read('src/session/human-directory.ts')).not.toMatch(/preview/i)
  })

  it('reads the mapping only where the application is composed', () => {
    const importers = execSync(
      'git grep -l "session/preview-identity" -- src || true',
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter((path) => path.length > 0 && !path.endsWith('.test.ts'))
      .sort()

    expect(importers).toEqual(['src/session/colony-human-directory.ts'])
  })
})

describe('the preview identity itself is never written down', () => {
  it('names the two variables in .env.example and holds no value for either', () => {
    const example = read('.env.example')

    for (const name of [
      'VITE_PREVIEW_IDENTITY_PROVIDER',
      'VITE_PREVIEW_IDENTITY_SUBJECT',
    ]) {
      expect(example).toContain(`${name}=`)
      expect(example).toMatch(new RegExp(`^${name}=\\s*$`, 'm'))
    }
  })

  it('carries no configured identity value in the preview bridge', () => {
    const bridge = [
      'src/session/preview-identity.ts',
      'src/session/colony-human-directory.ts',
      'src/session/provide-session.ts',
      '.env.example',
    ] as const

    for (const path of bridge) {
      const source = read(path)

      expect(source, `${path} must carry no composite identity literal`).not.toMatch(
        /[A-Za-z0-9_-]+\|[A-Za-z0-9_-]+/,
      )
      expect(source, `${path} must carry no email address`).not.toMatch(
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
      )
    }
  })
})
