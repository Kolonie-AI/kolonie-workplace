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

  it('composes the fixture implementation only where the app is wired', () => {
    const composition = readFileSync(
      resolve(process.cwd(), 'src/session/provide-session.ts'),
      'utf8',
    )

    expect(composition).toContain('fixture-workplace-session')
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
    }

    expectTypeOf(stub).toMatchTypeOf<WorkplaceSession>()
    expect(stub.currentHuman.value).toBeNull()
  })
})

describe('port boundary — no authentication machinery arrives in this issue', () => {
  it('adds no Auth0 SDK, OIDC library or network call to the session slice', () => {
    const sessionSources = [
      ...shellSources,
      'src/session/workplace-session.ts',
      'src/session/fixture-workplace-session.ts',
      'src/session/provide-session.ts',
    ]

    for (const path of sessionSources) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')

      expect(source, `${path} must add no authentication machinery`).not.toMatch(
        /auth0|openid|oidc|localStorage|sessionStorage|document\.cookie|\bfetch\(|XMLHttpRequest/i,
      )
    }
  })

  it('declares no authentication dependency in the manifest', () => {
    const manifest = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')

    expect(manifest).not.toMatch(/auth0|oidc|openid|jwt/i)
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
