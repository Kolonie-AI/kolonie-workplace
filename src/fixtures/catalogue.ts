import type {
  Agent,
  Board,
  Human,
  WorkItemDetail,
  WorkItemLabel,
} from '@/domain/workplace'

export const FIXTURE_HUMANS = {
  wren: 'fictional-human-wren',
  ash: 'fictional-human-ash',
  rook: 'fictional-human-rook',
} as const

/**
 * Federated identities for the fixture humans, keyed exactly as the Colony
 * keys them: `(provider, subject)`, where the provider is the Colony's own
 * name for the door and the subject is the provider's stable identifier.
 *
 * `wren` appears twice on purpose. One person who signs in with Google today
 * and GitHub tomorrow is one human, which is why the Colony holds identities in
 * their own table rather than as two columns on the human — and it is the case
 * a workplace login is most likely to get wrong by minting a second account.
 *
 * These are fictional subjects, not values from any tenant.
 */
export const FIXTURE_IDENTITIES = {
  wren: { provider: 'google', subject: 'fictional-subject-wren' },
  wrenSecondDoor: { provider: 'github', subject: 'fictional-subject-wren-github' },
  ash: { provider: 'github', subject: 'fictional-subject-ash' },
  rook: { provider: 'password', subject: 'fictional-subject-rook' },
} as const

export const FIXTURE_AGENTS = {
  quill: 'fictional-agent-quill',
  birch: 'fictional-agent-birch',
  marlow: 'fictional-agent-marlow',
} as const

export const FIXTURE_BOARDS = {
  quillDelivery: 'fictional-board-quill-delivery',
  birchResearch: 'fictional-board-birch-research',
  marlowOutreach: 'fictional-board-marlow-outreach',
  marlowBacklog: 'fictional-board-marlow-backlog',
} as const

export const fixtureHumans: readonly Human[] = [
  {
    id: FIXTURE_HUMANS.wren,
    name: 'Fictional Human Wren',
    agentIds: [FIXTURE_AGENTS.quill, FIXTURE_AGENTS.birch],
  },
  {
    id: FIXTURE_HUMANS.ash,
    name: 'Fictional Human Ash',
    agentIds: [FIXTURE_AGENTS.marlow],
  },
  {
    id: FIXTURE_HUMANS.rook,
    name: 'Fictional Human Rook',
    agentIds: [],
  },
]

export const fixtureAgents: readonly Agent[] = [
  {
    id: FIXTURE_AGENTS.quill,
    name: 'Fictional Agent Quill',
    profession: 'Coordinates fictional delivery systems for cooperative teams.',
    boardIds: [FIXTURE_BOARDS.quillDelivery],
  },
  {
    id: FIXTURE_AGENTS.birch,
    name: 'Fictional Agent Birch',
    profession: null,
    boardIds: [FIXTURE_BOARDS.birchResearch],
  },
  {
    id: FIXTURE_AGENTS.marlow,
    name: 'Fictional Agent Marlow',
    profession: 'Builds fictional outreach programmes for research communities.',
    boardIds: [FIXTURE_BOARDS.marlowOutreach, FIXTURE_BOARDS.marlowBacklog],
  },
]

export const fixtureBoards: readonly Board[] = [
  {
    id: FIXTURE_BOARDS.quillDelivery,
    agentId: FIXTURE_AGENTS.quill,
    title: 'Fictional Quill Delivery',
  },
  {
    id: FIXTURE_BOARDS.birchResearch,
    agentId: FIXTURE_AGENTS.birch,
    title: 'Fictional Birch Research',
  },
  {
    id: FIXTURE_BOARDS.marlowOutreach,
    agentId: FIXTURE_AGENTS.marlow,
    title: 'Fictional Marlow Outreach',
  },
  {
    id: FIXTURE_BOARDS.marlowBacklog,
    agentId: FIXTURE_AGENTS.marlow,
    title: 'Fictional Marlow Empty Backlog',
  },
]

export const FIXTURE_ITEMS = {
  inbox: 'fictional-item-inbox',
  ready: 'fictional-item-ready',
  inProgress: 'fictional-item-in-progress',
  blocked: 'fictional-item-blocked',
  review: 'fictional-item-review',
  done: 'fictional-item-done',
} as const

export const FIXTURE_LABELS = {
  intake: {
    id: 'fictional-label-intake',
    title: 'Intake',
    colour: '#1973ff',
  },
  delivery: {
    id: 'fictional-label-delivery',
    title: 'Delivery',
    colour: '#00db60',
  },
  operator: {
    id: 'fictional-label-operator',
    title: 'Operator',
    colour: '#ff4136',
  },
  research: {
    id: 'fictional-label-research',
    title: 'Research',
    colour: '#8338ec',
  },
} as const satisfies Record<string, WorkItemLabel>

const emptyBoardFields = {
  description: '',
  labels: [] as const,
  assignees: [] as const,
  priority: 'unset' as const,
  dueDate: null,
  percentDone: 0,
  checklist: [] as const,
  comments: [] as const,
  attachments: [] as const,
  coverColour: null,
  coverImageUrl: null,
  coverAttachmentId: null,
}

export const fixtureWorkItems: readonly WorkItemDetail[] = [
  {
    id: FIXTURE_ITEMS.inbox,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Triage the fictional intake note',
    lane: 'inbox',
    owner: 'Fictional Agent Quill',
    ...emptyBoardFields,
    labels: [FIXTURE_LABELS.intake],
    assignees: [{ id: FIXTURE_HUMANS.wren, name: 'Fictional Human Wren' }],
    priority: 'low',
    position: 0,
    externalReferences: [],
  },
  {
    id: FIXTURE_ITEMS.ready,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Draft the fictional delivery outline',
    lane: 'ready',
    owner: 'Fictional Agent Quill',
    ...emptyBoardFields,
    description: '<p>Outline the fictional delivery in three sections.</p>',
    labels: [FIXTURE_LABELS.delivery],
    priority: 'medium',
    dueDate: '2026-09-04',
    position: 0,
    externalReferences: [],
  },
  {
    id: FIXTURE_ITEMS.inProgress,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Write the fictional delivery outline',
    lane: 'in_progress',
    owner: 'Fictional Agent Quill',
    ...emptyBoardFields,
    description: '<p>Write the fictional delivery from the outline.</p>',
    labels: [FIXTURE_LABELS.delivery, FIXTURE_LABELS.research],
    assignees: [
      { id: FIXTURE_HUMANS.wren, name: 'Fictional Human Wren' },
      { id: 'fictional-human-ember', name: 'Fictional Operator Ember' },
    ],
    priority: 'high',
    dueDate: '2026-08-30',
    percentDone: 40,
    checklist: [
      {
        id: 'fictional-check-outline',
        title: 'Draft fictional introduction',
        done: true,
        position: 0,
      },
      {
        id: 'fictional-check-body',
        title: 'Write fictional body',
        done: false,
        position: 1,
      },
    ],
    comments: [
      {
        id: 'fictional-comment-start',
        author: 'Fictional Human Wren',
        body: '<p>Started the fictional body this morning.</p>',
        createdAt: '2026-08-26T09:00:00.000Z',
        updatedAt: '2026-08-26T09:00:00.000Z',
      },
      {
        id: 'fictional-comment-mid',
        author: 'Fictional Operator Ember',
        body: '<p>The fictional middle section is next.</p>',
        createdAt: '2026-08-26T12:00:00.000Z',
        updatedAt: '2026-08-26T12:00:00.000Z',
      },
      {
        id: 'fictional-comment-ask',
        author: 'Fictional Human Wren',
        body: '<p>Need a fictional example for the close.</p>',
        createdAt: '2026-08-26T15:00:00.000Z',
        updatedAt: '2026-08-26T15:00:00.000Z',
      },
    ],
    attachments: [
      {
        id: 'fictional-attachment-notes',
        name: 'fictional-outline.txt',
        size: 128,
        mimeType: 'text/plain',
      },
    ],
    coverColour: '#1973ff',
    position: 0,
    externalReferences: [],
  },
  {
    id: FIXTURE_ITEMS.blocked,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Confirm the fictional delivery window',
    lane: 'blocked',
    owner: 'Fictional Agent Quill',
    ...emptyBoardFields,
    labels: [FIXTURE_LABELS.operator],
    assignees: [{ id: 'fictional-human-ember', name: 'Fictional Operator Ember' }],
    priority: 'urgent',
    dueDate: '2026-08-20',
    position: 0,
    blocker: {
      actor: 'Fictional Operator Ember',
      smallestUnblock: 'Choose one of the fictional delivery windows',
    },
    externalReferences: [],
  },
  {
    id: FIXTURE_ITEMS.review,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Review the fictional catalogue summary',
    lane: 'review',
    owner: 'Fictional Agent Quill',
    ...emptyBoardFields,
    description: '<p>Review the typed summaries against the fictional catalogue.</p>',
    labels: [FIXTURE_LABELS.research],
    assignees: [{ id: FIXTURE_HUMANS.wren, name: 'Fictional Human Wren' }],
    priority: 'medium',
    dueDate: '2026-09-10',
    percentDone: 80,
    comments: [
      {
        id: 'fictional-comment-review',
        author: 'Fictional Operator Ember',
        body: '<p>The fictional summaries look complete.</p>',
        createdAt: '2026-08-25T16:00:00.000Z',
        updatedAt: '2026-08-25T16:00:00.000Z',
      },
    ],
    position: 0,
    handover: {
      done: 'Prepared the fictional catalogue for review',
      learned: 'The narrow fixture path is sufficient',
      next: 'Review the typed summaries',
      blocked: 'Nothing blocks the next step',
      evidence: [
        { label: 'Fictional typecheck evidence', href: '/fictional-evidence/typecheck' },
        { label: 'Fictional unit-test evidence', href: '/fictional-evidence/unit-test' },
      ],
    },
    externalReferences: [
      { label: 'Fictional review reference', href: '/fictional-reference/review' },
    ],
  },
  {
    id: FIXTURE_ITEMS.done,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Archive the fictional intake note',
    lane: 'done',
    owner: 'Fictional Agent Quill',
    ...emptyBoardFields,
    labels: [FIXTURE_LABELS.intake],
    priority: 'low',
    percentDone: 100,
    position: 0,
    externalReferences: [],
  },
  {
    id: 'fictional-item-foreign',
    boardId: FIXTURE_BOARDS.marlowOutreach,
    title: 'Prepare the fictional outreach list',
    lane: 'ready',
    owner: 'Fictional Agent Marlow',
    ...emptyBoardFields,
    labels: [FIXTURE_LABELS.operator],
    assignees: [{ id: FIXTURE_HUMANS.ash, name: 'Fictional Human Ash' }],
    priority: 'do_now',
    dueDate: '2026-08-28',
    position: 0,
    externalReferences: [],
  },
]
