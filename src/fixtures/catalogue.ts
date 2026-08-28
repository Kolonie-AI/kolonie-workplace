import type { Agent, Board, Human, WorkItemDetail } from '@/domain/workplace'

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

export const fixtureWorkItems: readonly WorkItemDetail[] = [
  {
    id: FIXTURE_ITEMS.inbox,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Triage the fictional intake note',
    lane: 'inbox',
    owner: 'Fictional Agent Quill',
    externalReferences: [],
  },
  {
    id: FIXTURE_ITEMS.ready,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Draft the fictional delivery outline',
    lane: 'ready',
    owner: 'Fictional Agent Quill',
    externalReferences: [],
  },
  {
    id: FIXTURE_ITEMS.inProgress,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Write the fictional delivery outline',
    lane: 'in_progress',
    owner: 'Fictional Agent Quill',
    externalReferences: [],
  },
  {
    id: FIXTURE_ITEMS.blocked,
    boardId: FIXTURE_BOARDS.quillDelivery,
    title: 'Confirm the fictional delivery window',
    lane: 'blocked',
    owner: 'Fictional Agent Quill',
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
    externalReferences: [],
  },
  {
    id: 'fictional-item-foreign',
    boardId: FIXTURE_BOARDS.marlowOutreach,
    title: 'Prepare the fictional outreach list',
    lane: 'ready',
    owner: 'Fictional Agent Marlow',
    externalReferences: [],
  },
]
