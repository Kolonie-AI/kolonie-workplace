import { describe, expect, it, vi } from 'vitest'
import { createWorkplaceMeClient, type WorkplaceMe } from '@/session/workplace-me'
import { WorkplaceForbidden, WorkplaceUnauthorized } from '@/gateway/workplace-http-errors'

function meResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('workplace /me client — delegations', () => {
  it('parses a delegations array alongside the agents array', async () => {
    const fetchImpl = vi.fn(async () =>
      meResponse({
        human: { id: 'human-operator' },
        agents: [{ id: 'agent-quill', handle: 'quill', status: 'citizen' }],
        delegations: [
          {
            delegationId: 'delegation-aurora',
            viaAgentId: 'agent-quill',
            viaHandle: 'quill',
            subjectId: 'agent-aurora',
            subjectHandle: 'aurora',
            status: 'active',
            capabilities: ['workplace-read', 'workplace-write'],
          },
        ],
      }),
    )
    const client = createWorkplaceMeClient({
      origin: 'https://platform.example.invalid',
      fetch: fetchImpl as unknown as typeof fetch,
    })

    const me = await client.me('token')

    expect(me.delegations).toEqual([
      {
        delegationId: 'delegation-aurora',
        viaAgentId: 'agent-quill',
        viaHandle: 'quill',
        subjectId: 'agent-aurora',
        subjectHandle: 'aurora',
        status: 'active',
        capabilities: ['workplace-read', 'workplace-write'],
      },
    ])
  })

  it('keeps an absent delegations array as an empty list, not a refusal', async () => {
    const fetchImpl = vi.fn(async () =>
      meResponse({
        human: { id: 'human-operator' },
        agents: [{ id: 'agent-quill', handle: 'quill', status: 'citizen' }],
      }),
    )
    const client = createWorkplaceMeClient({
      origin: 'https://platform.example.invalid',
      fetch: fetchImpl as unknown as typeof fetch,
    })

    const me = await client.me('token')

    expect(me.delegations).toEqual([])
  })

  it('keeps an empty delegations array as an honest empty list', async () => {
    const fetchImpl = vi.fn(async () =>
      meResponse({
        human: { id: 'human-operator' },
        agents: [{ id: 'agent-quill', handle: 'quill', status: 'citizen' }],
        delegations: [],
      }),
    )
    const client = createWorkplaceMeClient({
      origin: 'https://platform.example.invalid',
      fetch: fetchImpl as unknown as typeof fetch,
    })

    const me = await client.me('token')

    expect(me.delegations).toEqual([])
  })

  it('drops a delegation row that does not carry the identifying fields', async () => {
    const fetchImpl = vi.fn(async () =>
      meResponse({
        human: { id: 'human-operator' },
        agents: [],
        delegations: [
          'not-an-object',
          { delegationId: 'only-id' },
          {
            delegationId: 'delegation-aurora',
            viaAgentId: 'agent-quill',
            viaHandle: 'quill',
            subjectId: 'agent-aurora',
            subjectHandle: 'aurora',
            capabilities: [],
          },
        ],
      }),
    )
    const client = createWorkplaceMeClient({
      origin: 'https://platform.example.invalid',
      fetch: fetchImpl as unknown as typeof fetch,
    })

    const me = await client.me('token')

    expect(me.delegations).toEqual([
      {
        delegationId: 'delegation-aurora',
        viaAgentId: 'agent-quill',
        viaHandle: 'quill',
        subjectId: 'agent-aurora',
        subjectHandle: 'aurora',
        status: 'active',
        capabilities: [],
      },
    ])
  })

  it('still maps 401 and 403 to the typed session refusals', async () => {
    const unauthorized = createWorkplaceMeClient({
      origin: 'https://platform.example.invalid',
      fetch: vi.fn(async () => meResponse({}, 401)) as unknown as typeof fetch,
    })
    const forbidden = createWorkplaceMeClient({
      origin: 'https://platform.example.invalid',
      fetch: vi.fn(async () => meResponse({}, 403)) as unknown as typeof fetch,
    })

    await expect(unauthorized.me('token')).rejects.toBeInstanceOf(WorkplaceUnauthorized)
    await expect(forbidden.me('token')).rejects.toBeInstanceOf(WorkplaceForbidden)
  })
})

const _typecheck: WorkplaceMe = {
  human: { id: 'human-operator' },
  agents: [],
  delegations: [],
}
void _typecheck
