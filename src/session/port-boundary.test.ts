import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/vue'
import { ref } from 'vue'
import type { Human } from '@/domain/workplace'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import AppShell from '@/shell/AppShell.vue'
import {
  createFixtureWorkplaceSession,
  FixtureWorkplaceSession,
} from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION, type WorkplaceSession } from '@/session/workplace-session'

const shellSources = [
  'src/App.vue',
  'src/shell/AppShell.vue',
  'src/shell/views.ts',
  'src/session/SessionGate.vue',
  'src/session/SignedOutView.vue',
]

describe('port boundary — shell and board components see only the port', () => {
  it('imports the fixture implementation in no shell or board component', () => {
    for (const path of shellSources) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')

      expect(source, `${path} must not import the fixture session implementation`).not.toContain(
        'fixture-workplace-session',
      )
      expect(source, `${path} must not reach into the fixture catalogue`).not.toContain(
        '@/fixtures/catalogue',
      )
    }
  })

  it('composes the Auth0 implementation only where the app is wired', () => {
    const composition = readFileSync(
      resolve(process.cwd(), 'src/session/provide-session.ts'),
      'utf8',
    )

    expect(composition).toContain('auth0-workplace-session')
    expect(composition).toContain('fixture-workplace-session')
    expect(composition).toContain('isWorkplaceConfigAbsent(env)')
  })

  it('types the fixture picker as one implementation behind the interface', () => {
    expectTypeOf(createFixtureWorkplaceSession()).toMatchTypeOf<WorkplaceSession>()
    expectTypeOf<FixtureWorkplaceSession>().toMatchTypeOf<WorkplaceSession>()
  })

  it('accepts any other implementation of the port, fixture or not', () => {
    const stub: WorkplaceSession = {
      currentHuman: { value: null } as WorkplaceSession['currentHuman'],
      signIn: async () => undefined,
      signOut: async () => undefined,
      invalidateAuthentication: () => undefined,
    }

    expectTypeOf(stub).toMatchTypeOf<WorkplaceSession>()
    expect(stub.currentHuman.value).toBeNull()
  })
})

/**
 * Narrowed in #2, not deleted.
 *
 * This guard was written for #6, when the fixture was the only implementation
 * of the port and *any* authentication machinery in this layer meant something
 * had gone wrong. #2 is the issue that legitimately introduces it, so the rule
 * now applies where it was actually protecting something — the board and shell
 * components, and the port's own interface — while the Auth0 adapter is
 * allowed to contain exactly what it is for.
 *
 * The regression it exists to catch is unchanged and still caught: a board
 * component reaching for a token, a cookie or an SDK, or the port interface
 * growing an authentication concept that every implementation would then have
 * to satisfy.
 */
describe('port boundary — authentication stays out of the board and the port', () => {
  const MUST_STAY_CLEAN = [
    ...shellSources,
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
  ]

  it('keeps every board component and the port free of authentication machinery', () => {
    for (const path of MUST_STAY_CLEAN) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')

      expect(source, `${path} must contain no authentication machinery`).not.toMatch(
        /auth0|openid|oidc|localStorage|sessionStorage|document\.cookie|\bfetch\(|XMLHttpRequest/i,
      )
    }
  })

  it('keeps the fixture session free of it too, so the picker stays credential-free', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/session/fixture-workplace-session.ts'),
      'utf8',
    )

    expect(source).not.toMatch(
      /auth0|openid|oidc|localStorage|sessionStorage|document\.cookie|\bfetch\(|XMLHttpRequest/i,
    )
  })

  it('confines the Auth0 SDK to the adapter and the composition point', () => {
    const importers = [
      'src/session/auth0-client-adapter.ts',
      'src/session/provide-session.ts',
    ]

    for (const path of importers) {
      expect(readFileSync(resolve(process.cwd(), path), 'utf8')).toContain(
        '@auth0/auth0-spa-js',
      )
    }

    const elsewhere = [
      ...MUST_STAY_CLEAN,
      'src/session/auth0-workplace-session.ts',
      'src/session/workplace-me.ts',
    ]

    for (const path of elsewhere) {
      expect(
        readFileSync(resolve(process.cwd(), path), 'utf8'),
        `${path} must not import the Auth0 SDK`,
      ).not.toContain('@auth0/auth0-spa-js')
    }
  })

  it('declares exactly one authentication dependency, and no JWT or OIDC library', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string>; devDependencies: Record<string, string> }
    const declared = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    })

    expect(declared.filter((name) => /auth0/i.test(name))).toEqual([
      '@auth0/auth0-spa-js',
    ])
    expect(declared.filter((name) => /\b(jwt|jose|oidc|openid)\b/i.test(name))).toEqual([])
  })
})

describe('port boundary — the shell renders against any implementation of the port', () => {
  it('shows the identity of a hand-rolled session that the fixtures know nothing about', async () => {
    const human = ref<Human | null>({
      id: 'stub-human',
      name: 'Stub Human From Another Implementation',
      agentIds: [],
    })

    const stub: WorkplaceSession = {
      currentHuman: human,
      signIn: async () => undefined,
      signOut: async () => {
        human.value = null
      },
      invalidateAuthentication: () => {
        human.value = null
      },
    }

    render(AppShell, {
      global: {
        provide: {
          [WORKPLACE_SESSION]: stub,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
        },
      },
    })

    expect(screen.getByTestId('signed-in-human').textContent).toContain(
      'Stub Human From Another Implementation',
    )

    await fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(screen.queryByTestId('signed-in-human')).toBeNull()
  })
})
