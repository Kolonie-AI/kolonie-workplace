import type { User } from '@auth0/auth0-spa-js'
import type { Auth0Client, Auth0Subject } from '@/session/auth0-workplace-session'

/**
 * The slice of `@auth0/auth0-spa-js` this adapter drives. Naming it here keeps
 * the SDK at one seam and lets the adapter be tested without a tenant.
 */
export interface Auth0SdkClient {
  loginWithRedirect(options?: {
    authorizationParams?: { redirect_uri?: string }
  }): Promise<void>
  handleRedirectCallback(): Promise<{ appState?: unknown }>
  isAuthenticated(): Promise<boolean>
  getUser(): Promise<User | undefined>
  logout(options?: { logoutParams?: { returnTo?: string } }): Promise<void>
}

/**
 * The Colony's own name for each door, from the Auth0 strategy in `sub`.
 *
 * **This mirrors `connectionToProvider` in the platform's
 * `apps/api/src/humans/auth0.ts` and must keep mirroring it.** The pair
 * `(provider, subject)` is a primary key on `human_identities`, so if the
 * workplace derived `google-oauth2` where the console stored `google`, the same
 * person signing in at the two hosts would key to two different rows — one of
 * which does not exist, so the workplace would refuse a human the console
 * signs in perfectly well. That failure looks like a missing account rather
 * than like a mapping bug, which is why it is worth the duplication and the
 * note.
 *
 * `auth0` is the *strategy* of the database connection, whose name is
 * `Username-Password-Authentication`; the platform stores it as `password`.
 */
const STRATEGY_TO_PROVIDER: Readonly<Record<string, string>> = {
  'google-oauth2': 'google',
  twitter: 'x',
  auth0: 'password',
}

/**
 * Auth0 states a federated identity as `<strategy>|<subject>` in `sub`.
 *
 * The subject stored is the part **after** the first separator, matching what
 * the platform writes to `human_identities.subject` — the provider's stable
 * identifier, never the address, and never the composite. Only the first
 * separator splits, so a provider whose own identifier contains one survives
 * intact. A `sub` with no separator is not a federated identity this workplace
 * can key on, so it is refused rather than guessed at.
 */
export function parseFederatedSubject(user: User | undefined): Auth0Subject | null {
  const sub = user?.sub

  if (typeof sub !== 'string' || sub.length === 0) {
    return null
  }

  const separator = sub.indexOf('|')

  if (separator <= 0 || separator === sub.length - 1) {
    return null
  }

  const strategy = sub.slice(0, separator)

  return {
    provider: STRATEGY_TO_PROVIDER[strategy] ?? strategy,
    subject: sub.slice(separator + 1),
    emailVerified: user?.email_verified === true,
  }
}

/**
 * The session lives on the workplace origin alone.
 *
 * Every call goes through the SDK, whose storage is same-origin: this file
 * reads no `document.cookie` and writes none, so there is nothing here that
 * could accept a cookie issued for the console host — a cookie for another
 * origin is not sent to this one by the browser, and would not be looked at if
 * it were. What the two hosts share is the tenant and the `humans` row, which
 * is what the decision record asks for, and each holds its own callback.
 */
export class Auth0ClientAdapter implements Auth0Client {
  readonly #client: Auth0SdkClient
  readonly #callback: string
  readonly #origin: string

  constructor(client: Auth0SdkClient, callback: string, origin: string) {
    this.#client = client
    this.#callback = callback
    this.#origin = origin
  }

  async loginWithRedirect(): Promise<void> {
    await this.#client.loginWithRedirect({
      authorizationParams: { redirect_uri: this.#callback },
    })
  }

  async handleRedirectCallback(): Promise<void> {
    await this.#client.handleRedirectCallback()
  }

  async isAuthenticated(): Promise<boolean> {
    return this.#client.isAuthenticated()
  }

  async getSubject(): Promise<Auth0Subject | null> {
    return parseFederatedSubject(await this.#client.getUser())
  }

  async logout(): Promise<void> {
    await this.#client.logout({ logoutParams: { returnTo: this.#origin } })
  }
}
