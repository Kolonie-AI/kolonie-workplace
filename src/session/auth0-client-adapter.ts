import type { Auth0Client } from '@/session/auth0-workplace-session'

/**
 * The slice of `@auth0/auth0-spa-js` this adapter drives. Naming it here keeps
 * the SDK at one seam and lets the adapter be tested without a tenant.
 */
export interface Auth0SdkClient {
  loginWithRedirect(options?: {
    authorizationParams?: { redirect_uri?: string; audience?: string }
  }): Promise<void>
  handleRedirectCallback(): Promise<{ appState?: unknown }>
  isAuthenticated(): Promise<boolean>
  getTokenSilently(options?: {
    authorizationParams?: { audience?: string }
  }): Promise<string>
  logout(options?: { logoutParams?: { returnTo?: string } }): Promise<void>
}

export class Auth0ClientAdapter implements Auth0Client {
  readonly #client: Auth0SdkClient
  readonly #callback: string
  readonly #origin: string
  readonly #audience: string

  constructor(client: Auth0SdkClient, callback: string, origin: string, audience: string) {
    this.#client = client
    this.#callback = callback
    this.#origin = origin
    this.#audience = audience
  }

  async loginWithRedirect(): Promise<void> {
    await this.#client.loginWithRedirect({
      authorizationParams: { redirect_uri: this.#callback, audience: this.#audience },
    })
  }

  async handleRedirectCallback(): Promise<void> {
    await this.#client.handleRedirectCallback()
  }

  async isAuthenticated(): Promise<boolean> {
    return this.#client.isAuthenticated()
  }

  async getAccessToken(): Promise<string> {
    return this.#client.getTokenSilently({
      authorizationParams: { audience: this.#audience },
    })
  }

  async logout(): Promise<void> {
    await this.#client.logout({ logoutParams: { returnTo: this.#origin } })
  }
}
