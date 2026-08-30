import { WorkplaceUnauthorized, WorkplaceForbidden } from '@/gateway/workplace-http-errors'

export interface WorkplaceMeAgent {
  readonly id: string
  readonly handle: string
  readonly status: string
}

export interface WorkplaceMeHuman {
  readonly id: string
}

export interface WorkplaceMe {
  readonly human: WorkplaceMeHuman
  readonly agents: readonly WorkplaceMeAgent[]
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
  const fetchImpl = options.fetch ?? fetch

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

      return { human: { id: humanId }, agents }
    },
  }
}
