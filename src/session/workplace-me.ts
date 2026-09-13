import { WorkplaceUnauthorized, WorkplaceForbidden } from '@/gateway/workplace-http-errors'

export interface WorkplaceMeAgent {
  readonly id: string
  readonly handle: string
  readonly status: string
}

export interface WorkplaceMeDelegation {
  readonly delegationId: string
  readonly viaAgentId: string
  readonly viaHandle: string
  readonly subjectId: string
  readonly subjectHandle: string
  readonly status: string
  readonly capabilities: readonly string[]
}

export interface WorkplaceMeHuman {
  readonly id: string
}

export interface WorkplaceMe {
  readonly human: WorkplaceMeHuman
  readonly agents: readonly WorkplaceMeAgent[]
  readonly delegations?: readonly WorkplaceMeDelegation[]
}

export interface WorkplaceMeClient {
  me(token: string): Promise<WorkplaceMe>
}

function originRoot(origin: string): string {
  return origin.replace(/\/+$/, '')
}

export function createWorkplaceMeClient(options: {
  origin: string
  fetch?: typeof fetch
}): WorkplaceMeClient {
  const origin = originRoot(options.origin)
  /**
   * Bound to the global for the same reason the gateway binds it (#116): the
   * browser's `fetch` refuses a foreign receiver. This call site happens to be
   * safe today — `fetchImpl(...)` is a plain identifier call, so the receiver is
   * `undefined` rather than an object — but that is a property of how the line
   * is written, not of the value stored. Binding here states the requirement in
   * the value itself, so moving this call onto an object cannot resurrect the
   * production failure that took `/v1/workplace/boards` off the wire.
   */
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)

  return {
    async me(token: string): Promise<WorkplaceMe> {
      const response = await fetchImpl(`${origin}/v1/workplace/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit',
      })

      if (response.status === 401) {
        throw new WorkplaceUnauthorized()
      }
      if (response.status === 403) {
        throw new WorkplaceForbidden()
      }
      if (!response.ok) {
        throw new Error('Kolonie Workplace: the Colony could not say who you are.')
      }

      const body = (await response.json()) as {
        human?: { id?: unknown }
        agents?: unknown
        delegations?: unknown
      }
      const humanId = typeof body.human?.id === 'string' ? body.human.id : ''
      const agents = Array.isArray(body.agents)
        ? body.agents.flatMap((entry) => {
            if (typeof entry !== 'object' || entry === null) {
              return []
            }
            const row = entry as { id?: unknown; handle?: unknown; status?: unknown }
            if (typeof row.id !== 'string' || typeof row.handle !== 'string') {
              return []
            }
            return [
              {
                id: row.id,
                handle: row.handle,
                status: typeof row.status === 'string' ? row.status : 'citizen',
              },
            ]
          })
        : []
      const delegations = Array.isArray(body.delegations)
        ? body.delegations.flatMap((entry) => {
            if (typeof entry !== 'object' || entry === null) {
              return []
            }
            const row = entry as {
              delegationId?: unknown
              viaAgentId?: unknown
              viaHandle?: unknown
              subjectId?: unknown
              subjectHandle?: unknown
              status?: unknown
              capabilities?: unknown
            }
            if (
              typeof row.delegationId !== 'string' ||
              typeof row.viaAgentId !== 'string' ||
              typeof row.viaHandle !== 'string' ||
              typeof row.subjectId !== 'string' ||
              typeof row.subjectHandle !== 'string'
            ) {
              return []
            }
            return [
              {
                delegationId: row.delegationId,
                viaAgentId: row.viaAgentId,
                viaHandle: row.viaHandle,
                subjectId: row.subjectId,
                subjectHandle: row.subjectHandle,
                status: typeof row.status === 'string' ? row.status : 'active',
                capabilities: Array.isArray(row.capabilities)
                  ? row.capabilities.filter((capability): capability is string =>
                      typeof capability === 'string',
                    )
                  : [],
              },
            ]
          })
        : []

      return { human: { id: humanId }, agents, delegations }
    },
  }
}
