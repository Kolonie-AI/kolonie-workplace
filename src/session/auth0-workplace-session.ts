import { ref, type Ref } from 'vue'
import type { Human } from '@/domain/workplace'
import { IdentityNotRecognised } from '@/session/refusals'
import {
  createSessionCitizenStorage,
  type CitizenStorage,
} from '@/session/citizen-storage'
import type {
  DelegatedCitizen,
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

const DELEGATION_STORAGE_PREFIX = 'delegation:'

function asHuman(agent: LinkedCitizen): Human {
  return {
    id: agent.id,
    name: agent.handle,
    agentIds: [agent.id],
  }
}

function asDelegatedHuman(delegation: DelegatedCitizen): Human {
  return {
    id: delegation.subjectId,
    name: delegation.subjectHandle,
    agentIds: [delegation.subjectId],
  }
}

function storedDelegationId(stored: string): string | null {
  return stored.startsWith(DELEGATION_STORAGE_PREFIX)
    ? stored.slice(DELEGATION_STORAGE_PREFIX.length)
    : null
}

function storeDelegation(delegationId: string): string {
  return `${DELEGATION_STORAGE_PREFIX}${delegationId}`
}

export class Auth0Session implements Auth0WorkplaceSession {
  readonly #human: Ref<Human | null> = ref(null)
  readonly #agents: Ref<readonly LinkedCitizen[] | null> = ref(null)
  readonly #delegations: Ref<readonly DelegatedCitizen[] | null> = ref(null)
  readonly #activeDelegation: Ref<DelegatedCitizen | null> = ref(null)
  readonly #failure: Ref<WorkplaceSessionFailure | null> = ref(null)
  readonly #client: Auth0Client
  readonly #me: WorkplaceMeClient
  readonly #storage: CitizenStorage

  readonly currentHuman: Readonly<Ref<Human | null>> = this.#human
  readonly linkedAgents: Readonly<Ref<readonly LinkedCitizen[] | null>> = this.#agents
  readonly delegatedCitizens: Readonly<Ref<readonly DelegatedCitizen[] | null>> = this.#delegations
  readonly activeDelegation: Readonly<Ref<DelegatedCitizen | null>> = this.#activeDelegation
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
    this.#delegations.value = null
    this.#activeDelegation.value = null
    this.#failure.value = null
    this.#storage.clear()
    await this.#client.logout()
  }

  switchCitizen(): void {
    this.#human.value = null
    this.#activeDelegation.value = null
    this.#storage.clear()
  }

  pickCitizen(citizenId: string): void {
    const agents = this.#agents.value
    const agent = agents?.find((candidate) => candidate.id === citizenId)
    if (agent === undefined) {
      return
    }

    this.#activeDelegation.value = null
    this.#human.value = asHuman(agent)
    this.#storage.write(agent.id)
  }

  pickDelegatedCitizen(delegationId: string): void {
    const delegations = this.#delegations.value
    const delegation = delegations?.find(
      (candidate) => candidate.delegationId === delegationId,
    )
    if (delegation === undefined) {
      return
    }

    this.#activeDelegation.value = delegation
    this.#human.value = asDelegatedHuman(delegation)
    this.#storage.write(storeDelegation(delegation.delegationId))
  }

  invalidateAuthentication(): void {
    this.#human.value = null
    this.#agents.value = null
    this.#delegations.value = null
    this.#activeDelegation.value = null
    this.#failure.value = 'unauthorized'
    try {
      this.#storage.clear()
    } catch {
      return
    }
  }

  /**
   * The session is the one owner of its authentication state (#114). A typed
   * unauthorized token acquisition invalidates here, once, before the error
   * travels on to the gateway and the board composables — neither of which
   * writes session state. This was previously done both here and in the
   * gateway's token-failure path, which meant one state change was applied
   * twice per failure.
   */
  async getAccessToken(): Promise<string> {
    try {
      return await this.#client.getAccessToken()
    } catch (error) {
      if (error instanceof WorkplaceUnauthorized) {
        this.invalidateAuthentication()
      }
      throw error
    }
  }

  async #adopt({ refuse }: { refuse: boolean }): Promise<void> {
    this.#human.value = null
    this.#agents.value = null
    this.#delegations.value = null
    this.#activeDelegation.value = null
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
      const delegations: DelegatedCitizen[] = (directory.delegations ?? []).map((delegation) => ({
        delegationId: delegation.delegationId,
        viaAgentId: delegation.viaAgentId,
        viaHandle: delegation.viaHandle,
        subjectId: delegation.subjectId,
        subjectHandle: delegation.subjectHandle,
        status: delegation.status,
        capabilities: delegation.capabilities,
      }))
      this.#agents.value = agents
      this.#delegations.value = delegations

      const stored = this.#storage.read()
      if (stored === null) {
        return
      }

      const rememberedDelegationId = storedDelegationId(stored)
      if (rememberedDelegationId !== null) {
        const rememberedDelegation = delegations.find(
          (delegation) => delegation.delegationId === rememberedDelegationId,
        )
        if (rememberedDelegation !== undefined) {
          this.#activeDelegation.value = rememberedDelegation
          this.#human.value = asDelegatedHuman(rememberedDelegation)
          return
        }

        this.#storage.clear()
        return
      }

      const remembered = agents.find((agent) => agent.id === stored)
      if (remembered !== undefined) {
        this.#human.value = asHuman(remembered)
      } else {
        this.#storage.clear()
      }
    } catch (error) {
      this.#agents.value = null
      this.#delegations.value = null
      this.#activeDelegation.value = null
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
