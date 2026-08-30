import { isLane, type Lane } from '@/domain/lanes'
import type {
  AttachmentId,
  BoardId,
  CardLink,
  CardLinkId,
  CardLinkKind,
  CardLinkState,
  ChecklistItem,
  ChecklistItemId,
  CommentId,
  CreateAttachmentInput,
  CreateCardLinkInput,
  CreateCommentInput,
  CreateWorkItemInput,
  HumanId,
  ReorderWorkItemInput,
  UpdateChecklistItemInput,
  UpdateWorkItemInput,
  VisibleBoard,
  WorkItemComment,
  WorkItemDetail,
  WorkItemId,
  WorkItemLabel,
  WorkItemMoveInput,
  WorkItemPriority,
  WorkItemSummary,
} from '@/domain/workplace'
import { isCardLinkKind } from '@/domain/workplace'
import { BoardAccessRefused, WorkItemAccessRefused } from '@/gateway/refusals'
import type { TaskGateway } from '@/gateway/task-gateway'
import {
  AttachmentPreviewOnly,
  WorkplaceCitizenRequired,
  WorkplaceConflict,
  WorkplaceForbidden,
  WorkplaceHandoverRequired,
  WorkplaceInvalidTransition,
  WorkplaceLifecycleInputRequired,
  WorkplaceLinkUnresolvable,
  WorkplaceMultipleOwnersUnsupported,
  WorkplaceUnauthorized,
} from '@/gateway/workplace-http-errors'

export const WORKPLACE_CITIZEN_HEADER = 'X-Kolonie-Citizen'
export const WORKPLACE_API_PREFIX = '/v1/workplace'

export interface LinkedCitizen {
  readonly id: string
  readonly handle: string
}

export interface HttpTaskGatewayOptions {
  readonly origin: string
  readonly getToken: () => Promise<string>
  readonly getCitizen: () => LinkedCitizen | null
  readonly fetch?: typeof fetch
}

type Json = Record<string, unknown>

type CardState = {
  readonly boardId: BoardId
  readonly lane: Lane
  readonly ownerId: string | null
}

const LEGAL_TRANSITIONS: Readonly<Record<Lane, readonly Lane[]>> = {
  inbox: ['ready'],
  ready: ['inbox', 'in_progress'],
  in_progress: ['blocked', 'review', 'ready', 'done'],
  blocked: ['in_progress', 'ready'],
  review: ['in_progress', 'done', 'ready'],
  done: [],
}

const PRIORITIES: readonly WorkItemPriority[] = [
  'unset',
  'low',
  'medium',
  'high',
  'urgent',
  'do_now',
]

function asPriority(value: unknown): WorkItemPriority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value)
    ? (value as WorkItemPriority)
    : 'unset'
}

function asLane(value: unknown, itemId: string): Lane {
  if (typeof value === 'string' && isLane(value)) {
    return value
  }

  throw new WorkItemAccessRefused(itemId)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function originRoot(origin: string): string {
  return origin.replace(/\/+$/, '')
}

function errorCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const code = (body as Json).code
  return typeof code === 'string' ? code : null
}

export class HttpTaskGateway implements TaskGateway {
  readonly #origin: string
  readonly #getToken: () => Promise<string>
  readonly #getCitizen: () => LinkedCitizen | null
  readonly #fetch: typeof fetch
  readonly #boardVersions = new Map<BoardId, number>()
  readonly #cardVersions = new Map<WorkItemId, number>()
  readonly #cardStates = new Map<WorkItemId, CardState>()
  readonly #cardChecklists = new Map<WorkItemId, string>()

  constructor(options: HttpTaskGatewayOptions) {
    this.#origin = originRoot(options.origin)
    this.#getToken = options.getToken
    this.#getCitizen = options.getCitizen
    this.#fetch = options.fetch ?? fetch
  }

  async listVisibleBoards(humanId: HumanId): Promise<readonly VisibleBoard[]> {
    void humanId
    const pages = await this.#paginate(`${WORKPLACE_API_PREFIX}/boards`)
    return pages.map((row) => this.#toBoard(row))
  }

  async createBoard(_humanId: HumanId, title: string): Promise<VisibleBoard> {
    const body = await this.#request('POST', `${WORKPLACE_API_PREFIX}/boards`, {
      json: { title },
    })
    return this.#toBoard(body)
  }

  async renameBoard(
    _humanId: HumanId,
    boardId: BoardId,
    title: string,
  ): Promise<VisibleBoard> {
    const version = await this.#boardVersion(boardId)
    const body = await this.#request('PATCH', `${WORKPLACE_API_PREFIX}/boards/${boardId}`, {
      json: { title },
      ifMatch: version,
    })
    return this.#toBoard(body)
  }

  async archiveBoard(_humanId: HumanId, boardId: BoardId): Promise<void> {
    const version = await this.#boardVersion(boardId)
    await this.#request('POST', `${WORKPLACE_API_PREFIX}/boards/${boardId}/archive`, {
      ifMatch: version,
    })
  }

  async getBoardItems(
    _humanId: HumanId,
    boardId: BoardId,
  ): Promise<readonly WorkItemSummary[]> {
    try {
      const pages = await this.#paginate(`${WORKPLACE_API_PREFIX}/boards/${boardId}/cards`)
      return pages.map((row) => this.#toSummary(row))
    } catch (error) {
      if (error instanceof WorkItemAccessRefused) {
        throw new BoardAccessRefused(boardId)
      }

      throw error
    }
  }

  async getItemDetail(_humanId: HumanId, itemId: WorkItemId): Promise<WorkItemDetail> {
    const body = await this.#request('GET', `${WORKPLACE_API_PREFIX}/cards/${itemId}`)
    return this.#toDetail(body)
  }

  async moveItemToLane(
    _humanId: HumanId,
    itemId: WorkItemId,
    laneOrInput: Lane | WorkItemMoveInput,
    position?: number,
    lifecycle: Omit<WorkItemMoveInput, 'lane' | 'position'> = {},
  ): Promise<WorkItemDetail> {
    const lane = typeof laneOrInput === 'string' ? laneOrInput : laneOrInput.lane
    const requestedPosition =
      typeof laneOrInput === 'string' ? position : laneOrInput.position
    const requestedLifecycle =
      typeof laneOrInput === 'string' ? lifecycle : laneOrInput
    const state = this.#cardStates.get(itemId)
    if (state === undefined) {
      throw new WorkItemAccessRefused(itemId)
    }

    if (state.lane === lane) {
      if (requestedPosition === undefined) {
        return this.getItemDetail(_humanId, itemId)
      }
      return this.#move(itemId, lane, requestedPosition)
    }

    if (!LEGAL_TRANSITIONS[state.lane].includes(lane)) {
      throw new WorkplaceInvalidTransition()
    }

    if (state.lane === 'ready' && lane === 'in_progress') {
      return this.#lifecycle(itemId, 'claim')
    }

    if (lane === 'blocked') {
      if (requestedLifecycle.blockedBy === undefined || requestedLifecycle.unblockWhen === undefined) {
        throw new WorkplaceLifecycleInputRequired('blocker')
      }
      return this.#lifecycle(itemId, 'block', {
        blockedBy: requestedLifecycle.blockedBy,
        unblockWhen: requestedLifecycle.unblockWhen,
      })
    }

    if (lane === 'review') {
      return this.#lifecycle(itemId, 'request-review')
    }

    if (lane === 'done') {
      if (requestedLifecycle.outcome === undefined) {
        throw new WorkplaceLifecycleInputRequired('outcome')
      }
      return this.#lifecycle(itemId, 'complete', { outcome: requestedLifecycle.outcome })
    }

    return this.#move(itemId, lane, requestedPosition)
  }

  async createWorkItem(
    _humanId: HumanId,
    input: CreateWorkItemInput,
  ): Promise<WorkItemDetail> {
    const status = input.lane === 'ready' ? 'ready' : 'inbox'
    const json: Json = { title: input.title, status }
    if (input.description !== undefined) {
      json.description = input.description
    }

    const body = await this.#request(
      'POST',
      `${WORKPLACE_API_PREFIX}/boards/${input.boardId}/cards`,
      { json },
    )
    return this.#toDetailFromCard(body)
  }

  async updateWorkItem(
    _humanId: HumanId,
    itemId: WorkItemId,
    input: UpdateWorkItemInput,
  ): Promise<WorkItemDetail> {
    if (input.assignees !== undefined && input.assignees.length > 1) {
      throw new WorkplaceMultipleOwnersUnsupported()
    }

    const json: Json = {}
    if (input.title !== undefined) {
      json.title = input.title
    }
    if (input.description !== undefined) {
      json.description = input.description
    }
    if (input.priority !== undefined) {
      json.priority = input.priority
    }
    if (input.dueDate !== undefined) {
      json.dueAt = input.dueDate
    }
    if (input.coverColour !== undefined) {
      json.coverColour = input.coverColour
    }
    if (input.position !== undefined) {
      json.position = input.position
    }

    let updated: WorkItemDetail | null = null
    if (Object.keys(json).length > 0) {
      const version = await this.#cardVersion(itemId)
      const body = await this.#request('PATCH', `${WORKPLACE_API_PREFIX}/cards/${itemId}`, {
        json,
        ifMatch: version,
      })
      updated = this.#toDetailFromCard(body)
    }

    if (input.assignees !== undefined) {
      const state = this.#cardStates.get(itemId)
      const nextOwner = input.assignees[0]
      const ownerChanged =
        state !== undefined && nextOwner !== undefined && state.ownerId !== null && nextOwner.id !== state.ownerId
      if (ownerChanged) {
        if (input.handover === undefined) {
          throw new WorkplaceHandoverRequired()
        }
        const version = await this.#cardVersion(itemId)
        const body = await this.#request(
          'POST',
          `${WORKPLACE_API_PREFIX}/cards/${itemId}/handover`,
          {
            json: {
              toCitizenId: nextOwner.id,
              done: input.handover.done,
              learned: input.handover.learned,
              next: input.handover.next,
              ...(input.handover.blocked.trim() === ''
                ? {}
                : { blocked: input.handover.blocked }),
              evidenceLinks: input.handover.evidence.map((entry) => entry.href),
            },
            ifMatch: version,
          },
        )
        updated = this.#toDetailFromCard(body)
      }
    }

    return updated ?? this.getItemDetail(_humanId, itemId)
  }

  async deleteWorkItem(_humanId: HumanId, itemId: WorkItemId): Promise<void> {
    const version = await this.#cardVersion(itemId)
    await this.#request('POST', `${WORKPLACE_API_PREFIX}/cards/${itemId}/archive`, {
      ifMatch: version,
    })
  }

  async reorderWorkItem(
    _humanId: HumanId,
    itemId: WorkItemId,
    input: ReorderWorkItemInput,
  ): Promise<WorkItemDetail> {
    return this.#move(itemId, input.lane, input.position)
  }

  async #move(itemId: WorkItemId, lane: Lane, position?: number): Promise<WorkItemDetail> {
    const version = await this.#cardVersion(itemId)
    const body = await this.#request('POST', `${WORKPLACE_API_PREFIX}/cards/${itemId}/move`, {
      json: { status: lane, ...(position === undefined ? {} : { position }) },
      ifMatch: version,
    })
    return this.#toDetailFromCard(body)
  }

  async #lifecycle(
    itemId: WorkItemId,
    route: 'claim' | 'block' | 'request-review' | 'complete',
    json?: Json,
  ): Promise<WorkItemDetail> {
    const version = await this.#cardVersion(itemId)
    const body = await this.#request(
      'POST',
      `${WORKPLACE_API_PREFIX}/cards/${itemId}/${route}`,
      {
        ...(json === undefined ? {} : { json }),
        ifMatch: version,
      },
    )
    return this.#toDetailFromCard(body)
  }

  async createComment(
    humanId: HumanId,
    itemId: WorkItemId,
    input: CreateCommentInput,
  ): Promise<WorkItemDetail> {
    await this.#request('POST', `${WORKPLACE_API_PREFIX}/cards/${itemId}/comments`, {
      json: { body: input.body },
    })
    return this.getItemDetail(humanId, itemId)
  }

  async updateComment(
    _humanId: HumanId,
    itemId: WorkItemId,
    _commentId: CommentId,
    _body: string,
  ): Promise<WorkItemDetail> {
    void _commentId
    void _body
    throw new WorkItemAccessRefused(itemId)
  }

  async deleteComment(
    _humanId: HumanId,
    itemId: WorkItemId,
    _commentId: CommentId,
  ): Promise<WorkItemDetail> {
    void _commentId
    throw new WorkItemAccessRefused(itemId)
  }

  async addAttachment(
    _humanId: HumanId,
    _itemId: WorkItemId,
    _input: CreateAttachmentInput,
  ): Promise<WorkItemDetail> {
    void _humanId
    void _itemId
    void _input
    throw new AttachmentPreviewOnly()
  }

  async deleteAttachment(
    _humanId: HumanId,
    _itemId: WorkItemId,
    _attachmentId: AttachmentId,
  ): Promise<WorkItemDetail> {
    void _humanId
    void _itemId
    void _attachmentId
    throw new AttachmentPreviewOnly()
  }

  async listCardLinks(_humanId: HumanId, itemId: WorkItemId): Promise<readonly CardLink[]> {
    const body = await this.#request('GET', `${WORKPLACE_API_PREFIX}/cards/${itemId}/links`)
    return this.#links((body as Json).items)
  }

  async addCardLink(
    _humanId: HumanId,
    itemId: WorkItemId,
    input: CreateCardLinkInput,
  ): Promise<CardLink> {
    const json: Json = { kind: input.kind, ref: input.ref }
    if (input.note !== undefined && input.note.trim() !== '') {
      json.note = input.note.trim()
    }

    const body = await this.#request('POST', `${WORKPLACE_API_PREFIX}/cards/${itemId}/links`, {
      json,
    })
    const [created] = this.#links([body])
    if (created === undefined) {
      throw new WorkItemAccessRefused(itemId)
    }

    return created
  }

  async removeCardLink(_humanId: HumanId, linkId: CardLinkId): Promise<void> {
    await this.#request('DELETE', `${WORKPLACE_API_PREFIX}/links/${linkId}`)
  }

  async createChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    title: string,
  ): Promise<WorkItemDetail> {
    const checklistId = await this.#checklistId(humanId, itemId)
    await this.#request('POST', `${WORKPLACE_API_PREFIX}/checklists/${checklistId}/items`, {
      json: { title },
    })
    return this.getItemDetail(humanId, itemId)
  }

  async updateChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    checklistItemId: ChecklistItemId,
    input: UpdateChecklistItemInput,
  ): Promise<WorkItemDetail> {
    const json: Json = {}
    if (input.title !== undefined) {
      json.title = input.title
    }
    if (input.done !== undefined) {
      json.doneAt = input.done ? new Date().toISOString() : null
    }

    await this.#request('PATCH', `${WORKPLACE_API_PREFIX}/checklist-items/${checklistItemId}`, {
      json,
    })
    return this.getItemDetail(humanId, itemId)
  }

  async reorderChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    checklistItemId: ChecklistItemId,
    position: number,
  ): Promise<WorkItemDetail> {
    await this.#request('PATCH', `${WORKPLACE_API_PREFIX}/checklist-items/${checklistItemId}`, {
      json: { position },
    })
    return this.getItemDetail(humanId, itemId)
  }

  async deleteChecklistItem(
    humanId: HumanId,
    itemId: WorkItemId,
    checklistItemId: ChecklistItemId,
  ): Promise<WorkItemDetail> {
    await this.#request('DELETE', `${WORKPLACE_API_PREFIX}/checklist-items/${checklistItemId}`)
    return this.getItemDetail(humanId, itemId)
  }

  async #checklistId(humanId: HumanId, itemId: WorkItemId): Promise<string> {
    const cached = this.#cardChecklists.get(itemId)
    if (cached !== undefined) {
      return cached
    }

    const detail = await this.getItemDetail(humanId, itemId)
    const existing = this.#cardChecklists.get(itemId)
    if (existing !== undefined) {
      return existing
    }

    const created = await this.#request(
      'POST',
      `${WORKPLACE_API_PREFIX}/cards/${itemId}/checklists`,
      { json: { title: detail.title } },
    )
    const id = text((created as Json).id)
    if (id.length === 0) {
      throw new WorkItemAccessRefused(itemId)
    }

    this.#cardChecklists.set(itemId, id)
    return id
  }

  async #boardVersion(boardId: BoardId): Promise<number> {
    const cached = this.#boardVersions.get(boardId)
    if (cached !== undefined) {
      return cached
    }

    const body = await this.#request('GET', `${WORKPLACE_API_PREFIX}/boards/${boardId}`)
    const board = (body as Json).board ?? body
    this.#rememberBoard(board as Json)
    const version = this.#boardVersions.get(boardId)
    if (version === undefined) {
      throw new BoardAccessRefused(boardId)
    }

    return version
  }

  async #cardVersion(itemId: WorkItemId): Promise<number> {
    const cached = this.#cardVersions.get(itemId)
    if (cached !== undefined) {
      return cached
    }

    const body = await this.#request('GET', `${WORKPLACE_API_PREFIX}/cards/${itemId}`)
    this.#toDetail(body)
    const version = this.#cardVersions.get(itemId)
    if (version === undefined) {
      throw new WorkItemAccessRefused(itemId)
    }

    return version
  }

  async #paginate(path: string): Promise<Json[]> {
    const items: Json[] = []
    let cursor: string | null = null

    do {
      const url = cursor === null ? path : `${path}${path.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(cursor)}`
      const body = await this.#request('GET', url)
      const page = body as { items?: unknown; nextCursor?: unknown }
      const rows = Array.isArray(page.items) ? page.items : []
      for (const row of rows) {
        if (typeof row === 'object' && row !== null) {
          items.push(row as Json)
        }
      }
      cursor = typeof page.nextCursor === 'string' && page.nextCursor.length > 0
        ? page.nextCursor
        : null
    } while (cursor !== null)

    return items
  }

  async #request(
    method: string,
    path: string,
    options: { json?: Json; ifMatch?: number } = {},
  ): Promise<Json> {
    const citizen = this.#getCitizen()
    if (citizen === null) {
      throw new WorkplaceCitizenRequired()
    }

    const token = await this.#getToken()
    const headers = new Headers()
    headers.set('Authorization', `Bearer ${token}`)
    headers.set(WORKPLACE_CITIZEN_HEADER, citizen.id)
    if (options.json !== undefined) {
      headers.set('Content-Type', 'application/json')
    }
    if (options.ifMatch !== undefined) {
      headers.set('If-Match', String(options.ifMatch))
    }

    const init: RequestInit = {
      method,
      headers,
      credentials: 'omit',
    }
    if (options.json !== undefined) {
      init.body = JSON.stringify(options.json)
    }

    const response = await this.#fetch(`${this.#origin}${path}`, init)
    const raw = await response.text()
    let parsed: unknown = {}
    if (raw.length > 0) {
      try {
        parsed = JSON.parse(raw) as unknown
      } catch {
        parsed = {}
      }
    }

    if (!response.ok) {
      throw this.#refusal(response.status, parsed, path)
    }

    if (typeof parsed === 'object' && parsed !== null) {
      this.#remember(parsed as Json)
    }

    return typeof parsed === 'object' && parsed !== null ? (parsed as Json) : {}
  }

  #refusal(status: number, body: unknown, path: string): Error {
    if (status === 401) {
      return new WorkplaceUnauthorized()
    }
    if (status === 403) {
      return new WorkplaceForbidden()
    }
    if (status === 409 || errorCode(body) === 'conflict') {
      return new WorkplaceConflict()
    }
    if (errorCode(body) === 'workplace_invalid_transition') {
      return new WorkplaceInvalidTransition()
    }
    if (errorCode(body) === 'workplace_handover_required') {
      return new WorkplaceHandoverRequired()
    }
    if (errorCode(body) === 'workplace_link_unresolvable') {
      return new WorkplaceLinkUnresolvable()
    }
    if (status === 404 || errorCode(body) === 'not_found') {
      if (path.includes('/boards/') && path.includes('/cards') === false && path.includes('/cards/') === false) {
        const boardId = path.split('/boards/')[1]?.split(/[/?]/)[0]
        return new BoardAccessRefused(boardId ?? path)
      }
      if (path.includes('/boards/') && path.endsWith('/cards')) {
        const boardId = path.split('/boards/')[1]?.split('/')[0]
        return new BoardAccessRefused(boardId ?? path)
      }

      const cardId = path.split('/cards/')[1]?.split(/[/?]/)[0]
      return new WorkItemAccessRefused(cardId ?? path)
    }

    return new Error(
      `Kolonie Workplace: the Colony refused ${path} (${status}${
        errorCode(body) === null ? '' : `, ${errorCode(body)}`
      }).`,
    )
  }

  #remember(body: Json): void {
    if (Array.isArray(body.items)) {
      for (const item of body.items) {
        if (typeof item === 'object' && item !== null) {
          this.#rememberBoard(item as Json)
          this.#rememberCard(item as Json)
        }
      }
    }

    if (typeof body.card === 'object' && body.card !== null) {
      this.#rememberCard(body.card as Json)
    }

    if (typeof body.board === 'object' && body.board !== null) {
      this.#rememberBoard(body.board as Json)
    }

    this.#rememberBoard(body)
    this.#rememberCard(body)

    if (Array.isArray(body.checklists)) {
      const cardId = text(body.id) || text((body.card as Json | undefined)?.id)
      const first = body.checklists[0] as Json | undefined
      const checklist = (first?.checklist as Json | undefined) ?? first
      const checklistId = text(checklist?.id)
      if (cardId.length > 0 && checklistId.length > 0) {
        this.#cardChecklists.set(cardId, checklistId)
      }
    }
  }

  #rememberBoard(row: Json): void {
    const id = text(row.id)
    const version = number(row.version, 0)
    if (id.length > 0 && version > 0 && typeof row.ownerId === 'string') {
      this.#boardVersions.set(id, version)
    }
  }

  #rememberCard(row: Json): void {
    const id = text(row.id)
    const version = number(row.version, 0)
    if (id.length > 0 && version > 0 && typeof row.status === 'string') {
      const lane = asLane(row.status, id)
      this.#cardVersions.set(id, version)
      this.#cardStates.set(id, {
        boardId: text(row.boardId),
        lane,
        ownerId: nullableText(row.ownerId),
      })
    }
  }

  #toBoard(row: unknown): VisibleBoard {
    const board = typeof row === 'object' && row !== null ? (row as Json) : {}
    const nested = typeof board.board === 'object' && board.board !== null ? (board.board as Json) : board
    this.#rememberBoard(nested)
    const citizen = this.#getCitizen()

    return {
      id: text(nested.id),
      agentId: text(nested.ownerId),
      title: text(nested.title),
      agentName: citizen?.handle ?? 'Citizen',
      profession: null,
    }
  }

  #toSummary(row: unknown): WorkItemSummary {
    const card = typeof row === 'object' && row !== null ? (row as Json) : {}
    this.#rememberCard(card)
    const id = text(card.id)
    const ownerId = nullableText(card.ownerId)

    return {
      id,
      boardId: text(card.boardId),
      title: text(card.title),
      lane: asLane(card.status, id),
      owner: ownerId ?? 'Unassigned',
      description: '',
      labels: [],
      assignees: ownerId === null ? [] : [{ id: ownerId, name: ownerId }],
      priority: asPriority(card.priority),
      dueDate: nullableText(card.dueAt),
      percentDone: 0,
      checklist: [],
      comments: [],
      attachments: [],
      coverColour: nullableText(card.coverColour),
      coverImageUrl: null,
      coverAttachmentId: null,
      position: number(card.position),
    }
  }

  #toDetail(body: unknown): WorkItemDetail {
    const envelope = typeof body === 'object' && body !== null ? (body as Json) : {}
    const card =
      typeof envelope.card === 'object' && envelope.card !== null
        ? (envelope.card as Json)
        : envelope
    this.#rememberCard(card)

    const id = text(card.id)
    const ownerId = nullableText(card.ownerId)
    const labels = this.#labels(envelope.labels)
    const checklist = this.#checklist(id, envelope.checklists)
    const comments = this.#comments(envelope.comments)
    const handover = this.#handover(envelope.handover)
    const blockedBy = nullableText(card.blockedBy)
    const unblockWhen = nullableText(card.unblockWhen)

    return {
      id,
      boardId: text(card.boardId),
      title: text(card.title),
      lane: asLane(card.status, id),
      owner: ownerId ?? 'Unassigned',
      description: nullableText(card.description) ?? '',
      labels,
      assignees: ownerId === null ? [] : [{ id: ownerId, name: ownerId }],
      priority: asPriority(card.priority),
      dueDate: nullableText(card.dueAt),
      percentDone: checklist.length === 0
        ? 0
        : Math.round((checklist.filter((entry) => entry.done).length / checklist.length) * 100),
      checklist,
      comments,
      attachments: [],
      coverColour: nullableText(card.coverColour),
      coverImageUrl: null,
      coverAttachmentId: null,
      position: number(card.position),
      links: this.#links(envelope.links),
      ...(handover === undefined ? {} : { handover }),
      ...(blockedBy === null && unblockWhen === null
        ? {}
        : {
            blocker: {
              actor: blockedBy ?? '',
              smallestUnblock: unblockWhen ?? '',
            },
          }),
    }
  }

  #toDetailFromCard(body: unknown): WorkItemDetail {
    const envelope = typeof body === 'object' && body !== null ? (body as Json) : {}
    if (typeof envelope.card === 'object' && envelope.card !== null) {
      return this.#toDetail(body)
    }

    const summary = this.#toSummary(body)
    return {
      ...summary,
      links: [],
    }
  }

  #labels(value: unknown): WorkItemLabel[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return []
      }

      const row = entry as Json
      return [
        {
          id: text(row.id),
          title: text(row.name) || text(row.title),
          colour: text(row.colour),
        },
      ]
    })
  }

  #checklist(cardId: WorkItemId, value: unknown): ChecklistItem[] {
    if (!Array.isArray(value)) {
      return []
    }

    const items: ChecklistItem[] = []
    for (const entry of value) {
      if (typeof entry !== 'object' || entry === null) {
        continue
      }

      const row = entry as Json
      const checklist = (row.checklist as Json | undefined) ?? row
      const checklistId = text(checklist.id)
      if (checklistId.length > 0) {
        this.#cardChecklists.set(cardId, checklistId)
      }

      const nested = Array.isArray(row.items) ? row.items : []
      for (const item of nested) {
        if (typeof item !== 'object' || item === null) {
          continue
        }

        const check = item as Json
        items.push({
          id: text(check.id),
          title: text(check.title),
          done: check.doneAt !== null && check.doneAt !== undefined,
          position: number(check.position, items.length),
        })
      }
    }

    return items
  }

  #comments(value: unknown): WorkItemComment[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return []
      }

      const row = entry as Json
      return [
        {
          id: text(row.id),
          author: text(row.authorId) || text(row.author),
          body: text(row.body),
          createdAt: text(row.createdAt),
          updatedAt: text(row.updatedAt),
        },
      ]
    })
  }

  #handover(value: unknown): WorkItemDetail['handover'] {
    if (typeof value !== 'object' || value === null) {
      return undefined
    }

    const row = value as Json
    const evidence = Array.isArray(row.evidenceLinks)
      ? row.evidenceLinks.flatMap((href) =>
          typeof href === 'string' ? [{ label: href, href }] : [],
        )
      : []

    return {
      done: text(row.done),
      learned: text(row.learned),
      next: text(row.next),
      blocked: nullableText(row.blocked) ?? '',
      evidence,
    }
  }

  #links(value: unknown): CardLink[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return []
      }

      const row = entry as Json
      const kind = text(row.kind)
      const ref = text(row.ref)
      if (!isCardLinkKind(kind) || ref.length === 0) {
        return []
      }

      const target =
        typeof row.target === 'object' && row.target !== null ? (row.target as Json) : {}
      const resolved = linkProjection(kind, ref, target)
      const note = text(row.note)

      return [
        {
          id: text(row.id),
          kind,
          ref,
          ...(note.length > 0 ? { note } : {}),
          state: resolved.state,
          summary: resolved.summary,
        },
      ]
    })
  }
}

function linkProjection(
  kind: CardLinkKind,
  ref: string,
  target: Json,
): { state: CardLinkState; summary: string } {
  if (text(target.state) === 'unresolvable') {
    return { state: 'unresolvable', summary: 'Not resolvable' }
  }

  switch (kind) {
    case 'account':
      return { state: 'resolved', summary: text(target.identifier) || ref }
    case 'provider':
      return { state: 'resolved', summary: text(target.title) || ref }
    case 'vault':
      return { state: 'resolved', summary: text(target.name) || ref }
    case 'task':
    case 'playbook':
      return { state: 'resolved', summary: text(target.title) || ref }
    case 'url':
      return { state: 'resolved', summary: ref }
  }
}

export function createHttpTaskGateway(options: HttpTaskGatewayOptions): HttpTaskGateway {
  return new HttpTaskGateway(options)
}
