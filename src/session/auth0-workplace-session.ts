import { ref, type Ref } from 'vue'
import type { Human } from '@/domain/workplace'
import { IdentityNotRecognised } from '@/session/refusals'
import {
  createSessionCitizenStorage,
  type CitizenStorage,
} from '@/session/citizen-storage'
import type {
  LinkedCitizen,
  WorkplaceSession,
  WorkplaceSessionFailure,
} from '@/session/workplace-session'
import type { WorkplaceMeClient } from '@/session/workplace-me'
import { WorkplaceForbidden, WorkplaceUnauthorized } from '@/gateway/workplace-http-errors'

export interface Auth0Client {
  loginWithRedirect(): Promise<void>
  handleRedirectCallback(): Promise<void>
  isAuthenticated(): Promise<boolean>
  getAccessToken(): Promise<string>
  logout(): Promise<void>
}

export interface Auth0WorkplaceSession extends WorkplaceSession {
  completeSignIn(): Promise<void>
  restore(): Promise<void>
}

function asHuman(agent: LinkedCitizen): Human {
  return {
    id: agent.id,
    name: agent.handle,
    agentIds: [agent.id],
  }
}

export class Auth0Session implements Auth0WorkplaceSession {
  readonly #human: Ref<Human | null> = ref(null)
  readonly #agents: Ref<readonly LinkedCitizen[] | null> = ref(null)
  readonly #failure: Ref<WorkplaceSessionFailure | null> = ref(null)
  readonly #client: Auth0Client
  readonly #me: WorkplaceMeClient
  readonly #storage: CitizenStorage

  readonly currentHuman: Readonly<Ref<Human | null>> = this.#human
  readonly linkedAgents: Readonly<Ref<readonly LinkedCitizen[] | null>> = this.#agents
  readonly failure: Readonly<Ref<WorkplaceSessionFailure | null>> = this.#failure

  constructor(client: Auth0Client, me: WorkplaceMeClient, storage: CitizenStorage) {
    this.#client = client
    this.#me = me
    this.#storage = storage
  }

  async signIn(): Promise<void> {
    this.#failure.value = null
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
    this.#agents.value = null
    this.#failure.value = null
    this.#storage.clear()
    await this.#client.logout()
  }

  switchCitizen(): void {
    this.#human.value = null
    this.#storage.clear()
  }

  pickCitizen(citizenId: string): void {
    const agents = this.#agents.value
    const agent = agents?.find((candidate) => candidate.id === citizenId)
    if (agent === undefined) {
      return
    }

    this.#human.value = asHuman(agent)
    this.#storage.write(agent.id)
  }

  async getAccessToken(): Promise<string> {
    try {
      return await this.#client.getAccessToken()
    } catch (error) {
      if (error instanceof WorkplaceUnauthorized) {
        this.#human.value = null
        this.#storage.clear()
        this.#failure.value = 'unauthorized'
      }
      throw error
    }
  }

  async #adopt({ refuse }: { refuse: boolean }): Promise<void> {
    this.#human.value = null
    this.#agents.value = null
    this.#failure.value = null

    const authenticated = await this.#client.isAuthenticated()

    if (!authenticated) {
      if (refuse) {
        throw new IdentityNotRecognised()
      }

      return
    }

    try {
      const token = await this.#client.getAccessToken()
      const directory = await this.#me.me(token)
      const agents: LinkedCitizen[] = directory.agents.map((agent) => ({
        id: agent.id,
        handle: agent.handle,
        status: agent.status,
      }))
      this.#agents.value = agents

      const stored = this.#storage.read()
      const remembered = stored === null ? undefined : agents.find((agent) => agent.id === stored)
      if (remembered !== undefined) {
        this.#human.value = asHuman(remembered)
      } else if (stored !== null) {
        this.#storage.clear()
      }
    } catch (error) {
      this.#agents.value = null
      this.#storage.clear()
      if (error instanceof WorkplaceUnauthorized) {
        this.#failure.value = 'unauthorized'
      } else if (error instanceof WorkplaceForbidden) {
        this.#failure.value = 'forbidden'
      }
      if (refuse) {
        if (error instanceof WorkplaceUnauthorized) {
          throw new IdentityNotRecognised()
        }

        throw error
      }
    }
  }
}

export function createAuth0WorkplaceSession(
  client: Auth0Client,
  me: WorkplaceMeClient,
  storage: CitizenStorage = createSessionCitizenStorage(),
): Auth0WorkplaceSession {
  return new Auth0Session(client, me, storage)
}
