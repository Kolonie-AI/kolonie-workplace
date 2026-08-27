import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/vue'
import { chooseWorkplaceSession } from '@/session/provide-session'
import { asDevelopmentSignIn } from '@/session/development-sign-in'
import { createAuth0WorkplaceSession } from '@/session/auth0-workplace-session'
import SignedOutView from '@/session/SignedOutView.vue'
import { WORKPLACE_SESSION } from '@/session/workplace-session'

/**
 * A complete environment for composing the application: the tenant
 * configuration from #2 and the preview identity mapping from #39. Both are
 * required, so a test that composes a session has to supply both — the refusals
 * for each missing piece live in `auth0-config.test.ts` and
 * `preview-identity-boundary.test.ts`.
 *
 * Every value is fictional. The real ones arrive from the environment at build
 * time and are written down nowhere in this repository.
 */
const CONFIGURED = {
  VITE_AUTH0_DOMAIN: 'configured-domain',
  VITE_AUTH0_CLIENT_ID: 'configured-client-id',
  VITE_AUTH0_CALLBACK: 'https://workplace.example.invalid/sign-in/callback',
  VITE_PREVIEW_IDENTITY_PROVIDER: 'configured-provider',
  VITE_PREVIEW_IDENTITY_SUBJECT: 'configured-subject',
} as const

describe('the fixture picker is unreachable from application composition', () => {
  it('chooses the Auth0 session when configuration is present', () => {
    const session = chooseWorkplaceSession({ env: CONFIGURED })

    expect(asDevelopmentSignIn(session)).toBeNull()
  })

  it('refuses to start rather than falling back when configuration is missing', () => {
    expect(() => chooseWorkplaceSession({ env: {} })).toThrow(
      /VITE_AUTH0_DOMAIN/,
    )
  })

  it('never answers application composition with a session that lists humans', () => {
    const session = chooseWorkplaceSession({ env: CONFIGURED })

    expect((session as { listSignInCandidates?: unknown }).listSignInCandidates)
      .toBeUndefined()
  })

  it('refuses missing configuration on a development machine too', () => {
    expect(() => chooseWorkplaceSession({ env: {} })).toThrow(
      /VITE_AUTH0_CLIENT_ID/,
    )
  })
  it('never imports the fixture session in the application composition point', () => {
    const composition = readFileSync(
      resolve(process.cwd(), 'src/session/provide-session.ts'),
      'utf8',
    )

    expect(composition).not.toContain('fixture-workplace-session')
    expect(composition).not.toContain('createFixtureWorkplaceSession')
  })
})

describe('the signed-out view offers the hosted login, not a list of humans', () => {
  it('renders a sign-in control and no fixture picker for the Auth0 session', () => {
    const session = createAuth0WorkplaceSession(
      {
        loginWithRedirect: vi.fn(async () => undefined),
        handleRedirectCallback: vi.fn(async () => undefined),
        isAuthenticated: vi.fn(async () => false),
        getSubject: vi.fn(async () => null),
        logout: vi.fn(async () => undefined),
      },
      { resolve: vi.fn(async () => null) },
    )

    render(SignedOutView, {
      global: { provide: { [WORKPLACE_SESSION]: session } },
    })

    expect(screen.queryByTestId('fixture-sign-in')).toBeNull()
    expect(screen.getByTestId('hosted-sign-in')).toBeTruthy()
    expect(screen.queryByText(/Continue as/)).toBeNull()
  })

  it('starts the redirect when the sign-in control is used', async () => {
    const loginWithRedirect = vi.fn(async () => undefined)
    const session = createAuth0WorkplaceSession(
      {
        loginWithRedirect,
        handleRedirectCallback: vi.fn(async () => undefined),
        isAuthenticated: vi.fn(async () => false),
        getSubject: vi.fn(async () => null),
        logout: vi.fn(async () => undefined),
      },
      { resolve: vi.fn(async () => null) },
    )

    render(SignedOutView, {
      global: { provide: { [WORKPLACE_SESSION]: session } },
    })

    screen.getByTestId('hosted-sign-in').click()
    await Promise.resolve()

    expect(loginWithRedirect).toHaveBeenCalledTimes(1)
  })
})

describe('no tenant value reaches the repository', () => {
  const SOURCES = [
    'src/session/auth0-config.ts',
    'src/session/auth0-client-adapter.ts',
    'src/session/auth0-workplace-session.ts',
    'src/session/provide-session.ts',
    'src/session/SignedOutView.vue',
    '.env.example',
  ] as const

  it('names the variables and holds no value for any of them', () => {
    const example = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8')

    for (const name of [
      'VITE_AUTH0_DOMAIN',
      'VITE_AUTH0_CLIENT_ID',
      'VITE_AUTH0_CALLBACK',
    ]) {
      expect(example).toContain(`${name}=`)
      expect(example).toMatch(new RegExp(`^${name}=\\s*$`, 'm'))
    }
  })

  it('carries no tenant host name, client id or callback URL in the source', () => {
    for (const path of SOURCES) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')

      expect(source, `${path} must name no Auth0 tenant`).not.toMatch(
        /[a-z0-9-]+\.(eu|us|au|jp)?\.?auth0\.com/i,
      )
      expect(source, `${path} must carry no workplace host name`).not.toMatch(
        /workplace\.kolonie\.ai/i,
      )
      expect(source, `${path} must carry no IP address`).not.toMatch(
        /\b\d{1,3}(\.\d{1,3}){3}\b/,
      )
    }
  })

  /**
   * The whole tree, not only the files this issue added. A tenant value that
   * reached any source file would be committed configuration, and the point of
   * reading it from the environment is that it never is. Test files are
   * included deliberately: #2 forbids a tenant value in the diff, and a test
   * fixture is part of the diff. Every host these tests use is under
   * `.example.invalid`, which RFC 2606 reserves and no resolver answers.
   */
  it('names no tenant anywhere in src, including in the tests', () => {
    const tree = execSync('git ls-files src .env.example', { encoding: 'utf8' })
      .split('\n')
      .filter((path) => path.length > 0)

    for (const path of tree) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')

      expect(source, `${path} must name no Auth0 tenant`).not.toMatch(
        /[a-z0-9-]+\.(?:[a-z]{2}\.)?auth0\.com/i,
      )
      expect(source, `${path} must carry no workplace host name`).not.toMatch(
        /workplace\.kolonie\.ai/i,
      )
      expect(source, `${path} must carry no IP address`).not.toMatch(
        /\b\d{1,3}(\.\d{1,3}){3}\b/,
      )
    }
  })
})
