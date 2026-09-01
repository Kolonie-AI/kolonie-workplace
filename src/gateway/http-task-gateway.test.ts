import { afterEach, describe, expect, it, vi } from 'vitest'
import { FIXTURE_BOARDS, FIXTURE_ITEMS } from '@/fixtures/catalogue'
import { BoardAccessRefused } from '@/gateway/refusals'
import {
  WorkplaceConflict,
  WorkplaceForbidden,
  WorkplaceInvalidTransition,
  WorkplaceLinkUnresolvable,
  WorkplaceMultipleOwnersUnsupported,
  WorkplaceUnauthorized,
} from '@/gateway/workplace-http-errors'
import { isPreviewDataGateway } from '@/gateway/task-gateway'
import { createHttpTaskGateway } from '@/gateway/http-task-gateway'

const HUMAN_ID = '00000000-0000-4000-8000-000000000001'
const CITIZEN_ID = '00000000-0000-4000-8000-0000000000c1'
const OTHER_CITIZEN_ID = '00000000-0000-4000-8000-0000000000c2'
const BOARD_ID = '00000000-0000-4000-8000-0000000000b1'
const CARD_ID = '00000000-0000-4000-8000-0000000000a1'
const ACCOUNT_ID = '00000000-0000-4000-8000-0000000000d1'
const LINK_ID = '00000000-0000-4000-8000-0000000000e1'
const ORIGIN = 'https://platform.example.invalid'
const TOKEN = 'test-access-token'

const NOW = '2026-08-30T10:00:00.000Z'

function boardPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: BOARD_ID,
    ownerId: CITIZEN_ID,
    title: 'Live delivery board',
    kind: 'default',
    archivedAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function cardSummaryPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: CARD_ID,
    boardId: BOARD_ID,
    status: 'inbox',
    title: 'Ship the live cutover',
    ownerId: null,
    position: 1000,
    priority: 'unset',
    dueAt: null,
    version: 3,
    coverColour: null,
    labelCount: 0,
    checklistCount: 0,
    commentCount: 0,
    linkCount: 0,
    linkCounts: {
      account: 0,
      provider: 0,
      vault: 0,
      task: 0,
      playbook: 0,
      url: 0,
    },
    ...overrides,
  }
}

function cardPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: CARD_ID,
    boardId: BOARD_ID,
    status: 'inbox',
    title: 'Ship the live cutover',
    description: 'Cut the fixture gateway over.',
    ownerId: null,
    position: 1000,
    priority: 'unset',
    dueAt: null,
    blockedBy: null,
    unblockWhen: null,
    outcome: null,
    version: 3,
    coverColour: null,
    seedKey: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function gateway(
  fetchImpl: typeof fetch,
  citizenId: string | null = CITIZEN_ID,
  onUnauthorized?: () => void | undefined,
  getToken: () => Promise<string> = async () => TOKEN,
) {
  return createHttpTaskGateway({
    origin: ORIGIN,
    getToken,
    getCitizen: () =>
      citizenId === null ? null : { id: citizenId, handle: 'quill' },
    ...(onUnauthorized === undefined ? {} : { onUnauthorized }),
    fetch: fetchImpl,
  })
}

function recordedFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl: typeof fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const requestInit = init ?? {}
    calls.push({ url, init: requestInit })
    return handler(url, requestInit)
  }) as typeof fetch

  return { fetchImpl, calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('live HTTP gateway — boards and cards from the Colony door', () => {
  it('is not a preview-data gateway', () => {
    const { fetchImpl } = recordedFetch(() => jsonResponse(500, { code: 'not_found' }))

    expect(isPreviewDataGateway(gateway(fetchImpl))).toBe(false)
  })

  it('lists boards from GET /v1/workplace/boards, not from FIXTURE_*', async () => {
    const { fetchImpl, calls } = recordedFetch((url) => {
      if (url === `${ORIGIN}/v1/workplace/boards`) {
        return jsonResponse(200, { items: [boardPayload()], nextCursor: null })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const boards = await gateway(fetchImpl).listVisibleBoards(HUMAN_ID)

    expect(boards.map((board) => board.id)).toEqual([BOARD_ID])
    expect(boards[0]?.title).toBe('Live delivery board')
    expect(boards.map((board) => board.id)).not.toContain(FIXTURE_BOARDS.quillDelivery)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${ORIGIN}/v1/workplace/boards`)
    expect(calls[0]?.init.method ?? 'GET').toMatch(/^GET$/i)
    expect(header(calls[0]?.init, 'Authorization')).toBe(`Bearer ${TOKEN}`)
    expect(header(calls[0]?.init, 'X-Kolonie-Citizen')).toBe(CITIZEN_ID)
    expect(calls[0]?.init.credentials).toBe('omit')
  })

  it('follows board list cursors until the Colony says there is no next page', async () => {
    const { fetchImpl, calls } = recordedFetch((url) => {
      if (url === `${ORIGIN}/v1/workplace/boards`) {
        return jsonResponse(200, {
          items: [boardPayload({ id: '00000000-0000-4000-8000-0000000000b1' })],
          nextCursor: 'cursor-two',
        })
      }
      if (url === `${ORIGIN}/v1/workplace/boards?cursor=cursor-two`) {
        return jsonResponse(200, {
          items: [
            boardPayload({
              id: '00000000-0000-4000-8000-0000000000b2',
              title: 'Second live board',
              kind: 'additional',
            }),
          ],
          nextCursor: null,
        })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const boards = await gateway(fetchImpl).listVisibleBoards(HUMAN_ID)

    expect(boards.map((board) => board.id)).toEqual([
      '00000000-0000-4000-8000-0000000000b1',
      '00000000-0000-4000-8000-0000000000b2',
    ])
    expect(calls.map((call) => call.url)).toEqual([
      `${ORIGIN}/v1/workplace/boards`,
      `${ORIGIN}/v1/workplace/boards?cursor=cursor-two`,
    ])
  })

  it('creates a board with POST /v1/workplace/boards and the citizen header', async () => {
    const { fetchImpl, calls } = recordedFetch((url) => {
      if (url === `${ORIGIN}/v1/workplace/boards` && (calls.length === 0 || calls.at(-1)?.init.method === 'POST')) {
        return jsonResponse(
          201,
          boardPayload({ id: '00000000-0000-4000-8000-0000000000b9', title: 'New board', kind: 'additional' }),
          { ETag: '1' },
        )
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const created = await gateway(fetchImpl).createBoard(HUMAN_ID, 'New board')

    expect(created.title).toBe('New board')
    expect(created.id).toBe('00000000-0000-4000-8000-0000000000b9')
    const post = calls.find((call) => (call.init.method ?? '').toUpperCase() === 'POST')
    expect(post?.url).toBe(`${ORIGIN}/v1/workplace/boards`)
    expect(post?.init.body).toBe(JSON.stringify({ title: 'New board' }))
    expect(header(post?.init, 'X-Kolonie-Citizen')).toBe(CITIZEN_ID)
    expect(header(post?.init, 'Content-Type')).toBe('application/json')
  })

  it('renames a board with PATCH and If-Match, and archives with POST /archive', async () => {
    const { fetchImpl, calls } = recordedFetch((url, init) => {
      if (url === `${ORIGIN}/v1/workplace/boards` && (init.method ?? 'GET') === 'GET') {
        return jsonResponse(200, { items: [boardPayload({ version: 4 })], nextCursor: null })
      }
      if (url === `${ORIGIN}/v1/workplace/boards/${BOARD_ID}` && init.method === 'PATCH') {
        return jsonResponse(200, boardPayload({ title: 'Renamed', version: 5 }), { ETag: '5' })
      }
      if (url === `${ORIGIN}/v1/workplace/boards/${BOARD_ID}/archive` && init.method === 'POST') {
        return jsonResponse(200, boardPayload({ archivedAt: NOW, version: 6 }), { ETag: '6' })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const live = gateway(fetchImpl)
    await live.listVisibleBoards(HUMAN_ID)
    const renamed = await live.renameBoard(HUMAN_ID, BOARD_ID, 'Renamed')
    await live.archiveBoard(HUMAN_ID, BOARD_ID)

    expect(renamed.title).toBe('Renamed')
    const patch = calls.find((call) => call.init.method === 'PATCH')
    expect(header(patch?.init, 'If-Match')).toBe('4')
    expect(patch?.init.body).toBe(JSON.stringify({ title: 'Renamed' }))
    const archive = calls.find((call) => call.url.endsWith('/archive'))
    expect(header(archive?.init, 'If-Match')).toBe('5')
  })
})

describe('live HTTP gateway — cards', () => {
  it('lists cards from GET /v1/workplace/boards/:id/cards and never returns FIXTURE_* items', async () => {
    const { fetchImpl, calls } = recordedFetch((url) => {
      if (url === `${ORIGIN}/v1/workplace/boards/${BOARD_ID}/cards`) {
        return jsonResponse(200, { items: [cardSummaryPayload()], nextCursor: null })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const items = await gateway(fetchImpl).getBoardItems(HUMAN_ID, BOARD_ID)

    expect(items.map((item) => item.id)).toEqual([CARD_ID])
    expect(items[0]?.title).toBe('Ship the live cutover')
    expect(items[0]?.lane).toBe('inbox')
    expect(items.map((item) => item.id)).not.toContain(FIXTURE_ITEMS.ready)
    expect(calls[0]?.url).toBe(`${ORIGIN}/v1/workplace/boards/${BOARD_ID}/cards`)
    expect(header(calls[0]?.init, 'X-Kolonie-Citizen')).toBe(CITIZEN_ID)
  })

  it('creates a card with POST /v1/workplace/boards/:id/cards', async () => {
    const { fetchImpl, calls } = recordedFetch((url) => {
      if (url === `${ORIGIN}/v1/workplace/boards/${BOARD_ID}/cards`) {
        return jsonResponse(201, cardPayload({ title: 'Write the adapter', status: 'ready' }), {
          ETag: '1',
        })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const created = await gateway(fetchImpl).createWorkItem(HUMAN_ID, {
      boardId: BOARD_ID,
      title: 'Write the adapter',
      lane: 'ready',
    })

    expect(created.title).toBe('Write the adapter')
    expect(created.lane).toBe('ready')
    expect(created.id).toBe(CARD_ID)
    expect(calls[0]?.init.body).toBe(
      JSON.stringify({ title: 'Write the adapter', status: 'ready' }),
    )
    expect(header(calls[0]?.init, 'X-Kolonie-Citizen')).toBe(CITIZEN_ID)
  })

  it('edits a card with PATCH and If-Match, never sending an assignees array', async () => {
    const { fetchImpl, calls } = recordedFetch((url, init) => {
      if (url === `${ORIGIN}/v1/workplace/cards/${CARD_ID}` && (init.method ?? 'GET') === 'GET') {
        return jsonResponse(
          200,
          {
            card: cardPayload({ version: 3 }),
            labels: [],
            checklists: [],
            comments: [],
            links: [],
            handover: null,
          },
          { ETag: '3' },
        )
      }
      if (url === `${ORIGIN}/v1/workplace/cards/${CARD_ID}` && init.method === 'PATCH') {
        return jsonResponse(200, cardPayload({ title: 'Edited title', version: 4 }), { ETag: '4' })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const live = gateway(fetchImpl)
    await live.getItemDetail(HUMAN_ID, CARD_ID)
    const updated = await live.updateWorkItem(HUMAN_ID, CARD_ID, {
      title: 'Edited title',
      assignees: [{ id: OTHER_CITIZEN_ID, name: 'Someone' }],
    })

    expect(updated.title).toBe('Edited title')
    const patch = calls.find((call) => call.init.method === 'PATCH')
    expect(header(patch?.init, 'If-Match')).toBe('3')
    const body = JSON.parse(String(patch?.init.body)) as Record<string, unknown>
    expect(body).toEqual({ title: 'Edited title' })
    expect(body).not.toHaveProperty('assignees')
    expect(body).not.toHaveProperty('status')
  })

  it('drags a card with POST /v1/workplace/cards/:id/move, If-Match and the citizen header', async () => {
    const { fetchImpl, calls } = recordedFetch((url, init) => {
      if (url === `${ORIGIN}/v1/workplace/boards/${BOARD_ID}/cards`) {
        return jsonResponse(200, {
          items: [cardSummaryPayload({ status: 'inbox', version: 3 })],
          nextCursor: null,
        })
      }
      if (url === `${ORIGIN}/v1/workplace/cards/${CARD_ID}/move` && init.method === 'POST') {
        return jsonResponse(200, cardPayload({ status: 'ready', version: 4 }), { ETag: '4' })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const live = gateway(fetchImpl)
    await live.getBoardItems(HUMAN_ID, BOARD_ID)
    await live.moveItemToLane(HUMAN_ID, CARD_ID, 'ready')

    const move = calls.find((call) => call.url.endsWith('/move'))
    expect(move).toBeDefined()
    expect(header(move?.init, 'Authorization')).toBe(`Bearer ${TOKEN}`)
    expect(header(move?.init, 'X-Kolonie-Citizen')).toBe(CITIZEN_ID)
    expect(header(move?.init, 'If-Match')).toBe('3')
    expect(JSON.parse(String(move?.init.body))).toEqual({ status: 'ready' })
  })

  it('walks the legal six-lane lifecycle through the Platform routes and required inputs', async () => {
    let current = cardPayload()
    const { fetchImpl, calls } = recordedFetch((url, init) => {
      if (url === `${ORIGIN}/v1/workplace/boards/${BOARD_ID}/cards`) {
        return jsonResponse(200, {
          items: [cardSummaryPayload(current)],
          nextCursor: null,
        })
      }

      const body = init.body === undefined ? {} : JSON.parse(String(init.body)) as Record<string, unknown>
      const nextVersion = Number(current.version) + 1
      if (url.endsWith('/move') && body.status === 'ready') {
        current = cardPayload({ status: 'ready', version: nextVersion })
      } else if (url.endsWith('/claim')) {
        current = cardPayload({ status: 'in_progress', ownerId: CITIZEN_ID, version: nextVersion })
      } else if (url.endsWith('/block')) {
        current = cardPayload({
          status: 'blocked',
          ownerId: CITIZEN_ID,
          blockedBy: body.blockedBy,
          unblockWhen: body.unblockWhen,
          version: nextVersion,
        })
      } else if (url.endsWith('/move') && body.status === 'in_progress') {
        current = cardPayload({ status: 'in_progress', ownerId: CITIZEN_ID, version: nextVersion })
      } else if (url.endsWith('/request-review')) {
        current = cardPayload({ status: 'review', ownerId: CITIZEN_ID, version: nextVersion })
      } else if (url.endsWith('/complete')) {
        current = cardPayload({
          status: 'done',
          ownerId: CITIZEN_ID,
          outcome: body.outcome,
          version: nextVersion,
        })
      } else {
        return jsonResponse(404, { code: 'not_found' })
      }

      return jsonResponse(200, current, { ETag: String(nextVersion) })
    })

    const live = gateway(fetchImpl)
    await live.getBoardItems(HUMAN_ID, BOARD_ID)
    await live.moveItemToLane(HUMAN_ID, CARD_ID, { lane: 'ready', position: 0 })
    await live.moveItemToLane(HUMAN_ID, CARD_ID, { lane: 'in_progress', position: 0 })
    await live.moveItemToLane(HUMAN_ID, CARD_ID, {
      lane: 'blocked',
      position: 0,
      blockedBy: 'Waiting on the operator.',
      unblockWhen: 'The operator answers.',
    })
    await live.moveItemToLane(HUMAN_ID, CARD_ID, { lane: 'in_progress', position: 0 })
    await live.moveItemToLane(HUMAN_ID, CARD_ID, { lane: 'review', position: 0 })
    await live.moveItemToLane(HUMAN_ID, CARD_ID, {
      lane: 'done',
      position: 0,
      outcome: 'The live cutover shipped.',
    })

    const writes = calls.filter((call) => call.init.method === 'POST')
    expect(writes.map((call) => new URL(call.url).pathname)).toEqual([
      `/v1/workplace/cards/${CARD_ID}/move`,
      `/v1/workplace/cards/${CARD_ID}/claim`,
      `/v1/workplace/cards/${CARD_ID}/block`,
      `/v1/workplace/cards/${CARD_ID}/move`,
      `/v1/workplace/cards/${CARD_ID}/request-review`,
      `/v1/workplace/cards/${CARD_ID}/complete`,
    ])
    expect(JSON.parse(String(writes[0]?.init.body))).toEqual({ status: 'ready', position: 0 })
    expect(writes[1]?.init.body).toBeUndefined()
    expect(JSON.parse(String(writes[2]?.init.body))).toEqual({
      blockedBy: 'Waiting on the operator.',
      unblockWhen: 'The operator answers.',
    })
    expect(JSON.parse(String(writes[5]?.init.body))).toEqual({
      outcome: 'The live cutover shipped.',
    })
    expect(writes.map((call) => header(call.init, 'If-Match'))).toEqual([
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
    ])
  })

  it('refuses an illegal lifecycle move without sending a write', async () => {
    const { fetchImpl, calls } = recordedFetch((url) => {
      if (url === `${ORIGIN}/v1/workplace/boards/${BOARD_ID}/cards`) {
        return jsonResponse(200, {
          items: [cardSummaryPayload({ status: 'inbox', version: 3 })],
          nextCursor: null,
        })
      }
      return jsonResponse(500, { code: 'unexpected' })
    })

    const live = gateway(fetchImpl)
    await live.getBoardItems(HUMAN_ID, BOARD_ID)

    await expect(
      live.moveItemToLane(HUMAN_ID, CARD_ID, {
        lane: 'done',
        outcome: 'This must not skip the lifecycle.',
      }),
    ).rejects.toBeInstanceOf(WorkplaceInvalidTransition)
    expect(calls.filter((call) => call.init.method === 'POST')).toEqual([])
  })

  it('uses one atomic /move request for a positioned cross-lane drag', async () => {
    const { fetchImpl, calls } = recordedFetch((url) => {
      if (url === `${ORIGIN}/v1/workplace/boards/${BOARD_ID}/cards`) {
        return jsonResponse(200, {
          items: [cardSummaryPayload({ status: 'inbox', version: 3 })],
          nextCursor: null,
        })
      }
      if (url === `${ORIGIN}/v1/workplace/cards/${CARD_ID}/move`) {
        return jsonResponse(200, cardPayload({ status: 'ready', position: 7, version: 4 }))
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const live = gateway(fetchImpl)
    await live.getBoardItems(HUMAN_ID, BOARD_ID)
    await live.moveItemToLane(HUMAN_ID, CARD_ID, { lane: 'ready', position: 7 })

    const writes = calls.filter((call) => call.init.method === 'POST')
    expect(writes).toHaveLength(1)
    expect(writes[0]?.url).toBe(`${ORIGIN}/v1/workplace/cards/${CARD_ID}/move`)
    expect(JSON.parse(String(writes[0]?.init.body))).toEqual({ status: 'ready', position: 7 })
  })

  it('maps one owner through handover and refuses a silently ignored second owner', async () => {
    const { fetchImpl, calls } = recordedFetch((url, init) => {
      if (url === `${ORIGIN}/v1/workplace/cards/${CARD_ID}` && (init.method ?? 'GET') === 'GET') {
        return jsonResponse(200, {
          card: cardPayload({ status: 'in_progress', ownerId: CITIZEN_ID, version: 3 }),
          labels: [],
          checklists: [],
          comments: [],
          links: [],
          handover: null,
        })
      }
      if (url.endsWith('/handover')) {
        return jsonResponse(200, {
          card: cardPayload({ status: 'in_progress', ownerId: OTHER_CITIZEN_ID, version: 4 }),
          handover: {},
        })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const live = gateway(fetchImpl)
    await live.getItemDetail(HUMAN_ID, CARD_ID)
    await live.updateWorkItem(HUMAN_ID, CARD_ID, {
      assignees: [{ id: OTHER_CITIZEN_ID, name: 'Someone' }],
      handover: {
        done: 'Prepared the card.',
        learned: 'The owner must be singular.',
        next: 'Continue the live cutover.',
        blocked: '',
        evidence: [],
      },
    })

    const handover = calls.find((call) => call.url.endsWith('/handover'))
    expect(JSON.parse(String(handover?.init.body))).toEqual({
      toCitizenId: OTHER_CITIZEN_ID,
      done: 'Prepared the card.',
      learned: 'The owner must be singular.',
      next: 'Continue the live cutover.',
      evidenceLinks: [],
    })

    await expect(
      live.updateWorkItem(HUMAN_ID, CARD_ID, {
        assignees: [
          { id: OTHER_CITIZEN_ID, name: 'Someone' },
          { id: CITIZEN_ID, name: 'Quill' },
        ],
      }),
    ).rejects.toBeInstanceOf(WorkplaceMultipleOwnersUnsupported)
  })
})

describe('live HTTP gateway — typed card links', () => {
  it('lists all six resolved kinds plus an unresolvable row without exposing a vault value', async () => {
    const plantedVaultValue = 'planted-vault-value-never-exposed'
    const { fetchImpl, calls } = recordedFetch((url) => {
      if (url === `${ORIGIN}/v1/workplace/cards/${CARD_ID}/links`) {
        return jsonResponse(200, {
          items: [
            {
              id: LINK_ID,
              cardId: CARD_ID,
              kind: 'account',
              ref: ACCOUNT_ID,
              note: 'Primary mailbox',
              target: {
                state: 'resolved',
                kind: 'account',
                provider: null,
                identifier: 'fictional-account-summary',
                proved: true,
              },
            },
            {
              id: '00000000-0000-4000-8000-0000000000e2',
              cardId: CARD_ID,
              kind: 'provider',
              ref: 'fictional-provider',
              target: {
                state: 'resolved',
                kind: 'provider',
                title: 'Fictional Provider',
                category: 'mailbox',
              },
            },
            {
              id: '00000000-0000-4000-8000-0000000000e3',
              cardId: CARD_ID,
              kind: 'vault',
              ref: 'fictional/mailbox',
              target: {
                state: 'resolved',
                kind: 'vault',
                name: 'fictional/mailbox',
                held: true,
                value: plantedVaultValue,
              },
            },
            {
              id: '00000000-0000-4000-8000-0000000000e4',
              cardId: CARD_ID,
              kind: 'task',
              ref: '00000000-0000-4000-8000-0000000000f1',
              target: {
                state: 'resolved',
                kind: 'task',
                title: 'Fictional task',
                status: 'open',
              },
            },
            {
              id: '00000000-0000-4000-8000-0000000000e5',
              cardId: CARD_ID,
              kind: 'playbook',
              ref: '00000000-0000-4000-8000-0000000000f2',
              target: {
                state: 'resolved',
                kind: 'playbook',
                title: 'Fictional playbook',
                status: 'open',
              },
            },
            {
              id: '00000000-0000-4000-8000-0000000000e6',
              cardId: CARD_ID,
              kind: 'url',
              ref: `${ORIGIN}/reference/item`,
              target: { state: 'resolved', kind: 'url' },
            },
            {
              id: '00000000-0000-4000-8000-0000000000e7',
              cardId: CARD_ID,
              kind: 'account',
              ref: '00000000-0000-4000-8000-0000000000f3',
              target: { state: 'unresolvable', kind: 'account' },
            },
          ],
        })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const links = await gateway(fetchImpl).listCardLinks(HUMAN_ID, CARD_ID)

    expect(links.map((link) => link.kind)).toEqual([
      'account',
      'provider',
      'vault',
      'task',
      'playbook',
      'url',
      'account',
    ])
    expect(links[0]).toMatchObject({ summary: 'fictional-account-summary', note: 'Primary mailbox' })
    expect(links[2]).toMatchObject({ summary: 'fictional/mailbox' })
    expect(links[6]).toMatchObject({ state: 'unresolvable', summary: 'Not resolvable' })
    expect(JSON.stringify(links)).not.toContain(plantedVaultValue)
    expect(calls.every((call) => !call.url.includes('/vault'))).toBe(true)
    expect(header(calls[0]?.init, 'X-Kolonie-Citizen')).toBe(CITIZEN_ID)
  })

  it('adds an account and a vault-name link with matching POST payloads', async () => {
    const created = [
      {
        id: LINK_ID,
        cardId: CARD_ID,
        kind: 'account',
        ref: ACCOUNT_ID,
        note: 'Primary mailbox',
        target: {
          state: 'resolved',
          kind: 'account',
          provider: null,
          identifier: 'fictional-account-summary',
          proved: true,
        },
      },
      {
        id: '00000000-0000-4000-8000-0000000000e2',
        cardId: CARD_ID,
        kind: 'vault',
        ref: 'fictional/mailbox',
        target: {
          state: 'resolved',
          kind: 'vault',
          name: 'fictional/mailbox',
          held: true,
        },
      },
    ]
    let index = 0
    const { fetchImpl, calls } = recordedFetch(() => jsonResponse(201, created[index++]))
    const live = gateway(fetchImpl)

    const account = await live.addCardLink(HUMAN_ID, CARD_ID, {
      kind: 'account',
      ref: ACCOUNT_ID,
      note: 'Primary mailbox',
    })
    const vault = await live.addCardLink(HUMAN_ID, CARD_ID, {
      kind: 'vault',
      ref: 'fictional/mailbox',
    })

    expect(account.summary).toBe('fictional-account-summary')
    expect(vault.summary).toBe('fictional/mailbox')
    expect(calls.map((call) => JSON.parse(String(call.init.body)))).toEqual([
      { kind: 'account', ref: ACCOUNT_ID, note: 'Primary mailbox' },
      { kind: 'vault', ref: 'fictional/mailbox' },
    ])
    expect(calls.every((call) => call.url === `${ORIGIN}/v1/workplace/cards/${CARD_ID}/links`)).toBe(true)
  })

  it('removes one link through DELETE /v1/workplace/links/:linkId', async () => {
    const { fetchImpl, calls } = recordedFetch(() => new Response(null, { status: 204 }))

    await gateway(fetchImpl).removeCardLink(HUMAN_ID, LINK_ID)

    expect(calls[0]?.url).toBe(`${ORIGIN}/v1/workplace/links/${LINK_ID}`)
    expect(calls[0]?.init.method).toBe('DELETE')
    expect(header(calls[0]?.init, 'X-Kolonie-Citizen')).toBe(CITIZEN_ID)
  })

  it('types a link target that cannot be resolved', async () => {
    const { fetchImpl } = recordedFetch(() =>
      jsonResponse(422, {
        code: 'workplace_link_unresolvable',
        message: 'Nothing matches that kind and ref.',
      }),
    )

    await expect(
      gateway(fetchImpl).addCardLink(HUMAN_ID, CARD_ID, { kind: 'account', ref: ACCOUNT_ID }),
    ).rejects.toBeInstanceOf(WorkplaceLinkUnresolvable)
  })
})

describe('live HTTP gateway — rejection', () => {
  it('rolls a conflicting drag into WorkplaceConflict and never pretends the move landed', async () => {
    const { fetchImpl } = recordedFetch((url, init) => {
      if (url === `${ORIGIN}/v1/workplace/boards/${BOARD_ID}/cards`) {
        return jsonResponse(200, {
          items: [cardSummaryPayload({ status: 'inbox', version: 3 })],
          nextCursor: null,
        })
      }
      if (url.endsWith('/move') && init.method === 'POST') {
        return jsonResponse(409, { code: 'conflict', message: 'That version is stale.' })
      }
      return jsonResponse(404, { code: 'not_found' })
    })

    const live = gateway(fetchImpl)
    await live.getBoardItems(HUMAN_ID, BOARD_ID)

    await expect(live.moveItemToLane(HUMAN_ID, CARD_ID, 'ready')).rejects.toBeInstanceOf(
      WorkplaceConflict,
    )
  })

  it('does not send X-Kolonie-Citizen when no citizen is selected', async () => {
    const { fetchImpl, calls } = recordedFetch(() =>
      jsonResponse(400, { code: 'validation_failed' }),
    )

    await expect(gateway(fetchImpl, null).listVisibleBoards(HUMAN_ID)).rejects.toThrow(
      /citizen/i,
    )
    expect(calls).toEqual([])
  })

  it('issues the board request after token acquisition succeeds', async () => {
    const getToken = vi.fn(async () => TOKEN)
    const { fetchImpl, calls } = recordedFetch(() =>
      jsonResponse(200, { items: [boardPayload()], nextCursor: null }),
    )

    const boards = await gateway(fetchImpl, CITIZEN_ID, undefined, getToken)
      .listVisibleBoards(HUMAN_ID)

    expect(getToken).toHaveBeenCalledTimes(1)
    expect(calls.map((call) => call.url)).toEqual([`${ORIGIN}/v1/workplace/boards`])
    expect(boards[0]?.title).toBe('Live delivery board')
  })

  it('invalidates when typed unauthorized token acquisition fails before fetch', async () => {
    const refusal = new WorkplaceUnauthorized()
    const getToken = vi.fn(async () => { throw refusal })
    const onUnauthorized = vi.fn()
    const { fetchImpl, calls } = recordedFetch(() =>
      jsonResponse(200, { items: [], nextCursor: null }),
    )

    await expect(
      gateway(fetchImpl, CITIZEN_ID, onUnauthorized, getToken).listVisibleBoards(HUMAN_ID),
    ).rejects.toBe(refusal)

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([])
  })

  it('invalidates a response 401 before reading a rejecting body', async () => {
    const bodyFailure = new Error('body unavailable')
    const response = {
      ok: false,
      status: 401,
      text: vi.fn(async () => { throw bodyFailure }),
    } as unknown as Response
    const { fetchImpl } = recordedFetch(() => response)
    const onUnauthorized = vi.fn()

    await expect(gateway(fetchImpl, CITIZEN_ID, onUnauthorized).listVisibleBoards(HUMAN_ID))
      .rejects.toBeInstanceOf(WorkplaceUnauthorized)

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(response.text).not.toHaveBeenCalled()
  })

  it('preserves response unauthorized when the invalidator throws', async () => {
    const { fetchImpl } = recordedFetch(() => jsonResponse(401, { code: 'unauthorized' }))
    const onUnauthorized = vi.fn(() => { throw new Error('cleanup failed') })

    await expect(gateway(fetchImpl, CITIZEN_ID, onUnauthorized).listVisibleBoards(HUMAN_ID))
      .rejects.toBeInstanceOf(WorkplaceUnauthorized)

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('preserves token unauthorized when the invalidator throws', async () => {
    const refusal = new WorkplaceUnauthorized()
    const getToken = vi.fn(async () => { throw refusal })
    const onUnauthorized = vi.fn(() => { throw new Error('cleanup failed') })
    const { fetchImpl } = recordedFetch(() => jsonResponse(200, {}))

    await expect(
      gateway(fetchImpl, CITIZEN_ID, onUnauthorized, getToken).listVisibleBoards(HUMAN_ID),
    ).rejects.toBe(refusal)

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not notify the session invalidator for a generic board failure', async () => {
    const { fetchImpl } = recordedFetch(() => jsonResponse(500, { code: 'failure' }))
    const onUnauthorized = vi.fn()

    await expect(gateway(fetchImpl, CITIZEN_ID, onUnauthorized).listVisibleBoards(HUMAN_ID))
      .rejects.toThrow()

    expect(onUnauthorized).not.toHaveBeenCalled()
  })


  it('treats 403 as a deployment error, not a re-login', async () => {
    const { fetchImpl } = recordedFetch(() =>
      jsonResponse(403, { code: 'forbidden', message: 'This origin is not the workplace.' }),
    )

    await expect(gateway(fetchImpl).listVisibleBoards(HUMAN_ID)).rejects.toBeInstanceOf(
      WorkplaceForbidden,
    )
  })

  it('refuses a missing board as BoardAccessRefused rather than an empty list', async () => {
    const { fetchImpl } = recordedFetch(() =>
      jsonResponse(404, { code: 'not_found', message: 'No board matches the id you named.' }),
    )

    await expect(gateway(fetchImpl).getBoardItems(HUMAN_ID, BOARD_ID)).rejects.toBeInstanceOf(
      BoardAccessRefused,
    )
  })

  it('does not POST file bytes when addAttachment is called against the live door', async () => {
    const { fetchImpl, calls } = recordedFetch(() =>
      jsonResponse(200, {
        card: cardPayload(),
        labels: [],
        checklists: [],
        comments: [],
        links: [],
        handover: null,
      }),
    )

    const live = gateway(fetchImpl)
    const file = new File(['pretend-bytes'], 'notes.txt', { type: 'text/plain' })

    await expect(
      live.addAttachment(HUMAN_ID, CARD_ID, {
        name: 'notes.txt',
        size: 13,
        mimeType: 'text/plain',
        file,
      }),
    ).rejects.toThrow(/preview|attachment/i)

    expect(calls.filter((call) => (call.init.method ?? 'GET').toUpperCase() !== 'GET')).toEqual([])
    expect(JSON.stringify(calls)).not.toContain('pretend-bytes')
  })

  it('never puts a cookie or credentials mode other than omit on the wire', async () => {
    const { fetchImpl, calls } = recordedFetch(() =>
      jsonResponse(200, { items: [], nextCursor: null }),
    )

    await gateway(fetchImpl).listVisibleBoards(HUMAN_ID)

    expect(calls[0]?.init.credentials).toBe('omit')
    expect(header(calls[0]?.init, 'Cookie')).toBeNull()
    expect(header(calls[0]?.init, 'Authorization')).toMatch(/^Bearer /)
  })
})

function header(init: RequestInit | undefined, name: string): string | null {
  if (init === undefined) {
    return null
  }

  const headers = init.headers
  if (headers === undefined) {
    return null
  }

  if (headers instanceof Headers) {
    return headers.get(name)
  }

  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase())
    return found?.[1] ?? null
  }

  const record = headers as Record<string, string>
  const key = Object.keys(record).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
  return key === undefined ? null : record[key] ?? null
}
