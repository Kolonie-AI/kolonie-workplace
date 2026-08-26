import { ref, type Ref } from 'vue'
import type { Human } from '@/domain/workplace'
import type { HumanDirectory } from '@/session/human-directory'
import { IdentityNotRecognised, IdentityUnverified } from '@/session/refusals'
import type { WorkplaceSession } from '@/session/workplace-session'

/**
 * The slice of an Auth0 client this session actually uses, named as a port of
 * its own so the session is testable without a tenant, a browser redirect or a
 * network. The SDK is wired to it in `provide-session.ts`.
 */
export interface Auth0Subject {
  readonly provider: string
  readonly subject: string
  readonly emailVerified: boolean
}

export interface Auth0Client {
  loginWithRedirect(): Promise<void>
  handleRedirectCallback(): Promise<void>
  isAuthenticated(): Promise<boolean>
  getSubject(): Promise<Auth0Subject | null>
  logout(): Promise<void>
}

export interface Auth0WorkplaceSession extends WorkplaceSession {
  completeSignIn(): Promise<void>
  restore(): Promise<void>
}

export class Auth0Session implements Auth0WorkplaceSession {
  readonly #human: Ref<Human | null> = ref(null)
  readonly #client: Auth0Client
  readonly #humans: HumanDirectory

  readonly currentHuman: Readonly<Ref<Human | null>> = this.#human

  constructor(client: Auth0Client, humans: HumanDirectory) {
    this.#client = client
    this.#humans = humans
  }

  /**
   * Sign-in is a redirect to the hosted login and nothing else. The workplace
   * never sees a credential, which is the point of federating: there is no
   * password field here to get wrong.
   */
  async signIn(): Promise<void> {
    await this.#client.loginWithRedirect()
  }

  async completeSignIn(): Promise<void> {
    await this.#client.handleRedirectCallback()
    await this.#adopt({ refuse: true })
  }

  async restore(): Promise<void> {
    await this.#adopt({ refuse: false })
  }

  async signOut(): Promise<void> {
    this.#human.value = null
    await this.#client.logout()
  }

  /**
   * The one place a human is adopted, so every route in holds to the same two
   * refusals. `restore` is quiet because an absent session on load is the
   * ordinary state of a page nobody has signed into; `completeSignIn` refuses
   * loudly because somebody has just come back from the login expecting to be
   * signed in, and silence there would look like success.
   */
  async #adopt({ refuse }: { refuse: boolean }): Promise<void> {
    this.#human.value = null

    const authenticated = await this.#client.isAuthenticated()
    const subject = authenticated ? await this.#client.getSubject() : null

    if (subject === null) {
      if (refuse) {
        throw new IdentityNotRecognised()
      }

      return
    }

    if (!subject.emailVerified) {
      if (refuse) {
        throw new IdentityUnverified()
      }

      return
    }

    const human = await this.#humans.resolve(subject.provider, subject.subject)

    if (human === null) {
      if (refuse) {
        throw new IdentityNotRecognised()
      }

      return
    }

    this.#human.value = human
  }
}

export function createAuth0WorkplaceSession(
  client: Auth0Client,
  humans: HumanDirectory,
): Auth0WorkplaceSession {
  return new Auth0Session(client, humans)
}
