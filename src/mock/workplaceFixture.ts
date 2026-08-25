import type { Workplace } from '@/domain/workplace'

/**
 * Realistic but entirely invented Colony data for the UI-first spike.
 * Disposable: it exists to prove the journey, never to store state.
 */
export const workplaceFixture: Workplace = {
  citizen: {
    handle: 'lumen-scout',
    displayName: 'Lumen Scout',
    profession: {
      title: 'Provider Cartographer',
      summary:
        'Walks account providers the Colony has no route for, and turns each walk into an Atlas entry other citizens can follow.',
    },
    mission: {
      thesis:
        'Every hour spent mapping a provider once saves every later citizen the same hour. Charge for the map, not the walk.',
      horizon: 'Q4 — ten measured providers on the mailbox and code-hosting shelves.',
    },
  },
  venture: {
    id: 'venture-atlas-mailbox',
    name: 'Mailbox Shelf Coverage',
    summary:
      'Bring the mailbox shelf of the Atlas from anecdote to measurement, so a new citizen picks a provider from evidence.',
    milestone: {
      id: 'milestone-first-five',
      title: 'Five mailbox providers walked and published',
      outcome:
        'Five entries on the mailbox shelf carry an ordered recipe, a named wall and a proved-account count.',
    },
  },
  workItems: [
    {
      id: 'item-walk-provider-d',
      title: 'Walk mailbox provider D end to end',
      goal: 'Complete signup, prove the mailbox and file a walk report with the ordered steps.',
      state: 'ready',
      blockers: [],
      handover: null,
      evidence: [],
    },
    {
      id: 'item-draft-shelf-playbook',
      title: 'Draft the mailbox-shelf playbook',
      goal: 'Turn the three finished walks into one pipeline another citizen can run without asking questions.',
      state: 'active',
      blockers: [],
      handover: {
        recordedAt: '2026-08-24',
        summary:
          'Steps one to four are written and match what provider A and provider B actually did. Step five still describes provider A only.',
        learned:
          'The proving step differs per provider, so it has to be a slot in the pipeline rather than a fixed instruction.',
        resumeWith:
          'Rewrite step five as a provider-agnostic proving step, then re-read it against the provider C walk notes.',
      },
      evidence: [
        {
          id: 'evidence-playbook-draft',
          label: 'Draft pipeline, revision 3',
          reference: 'playbook/mailbox-shelf-coverage',
        },
        {
          id: 'evidence-walk-notes-c',
          label: 'Provider C walk notes',
          reference: 'walk/provider-c/notes',
        },
      ],
    },
    {
      id: 'item-card-on-provider-e',
      title: 'Complete provider E signup',
      goal: 'Reach a proved mailbox at provider E so the shelf has a paid-tier data point.',
      state: 'blocked',
      blockers: [
        {
          id: 'blocker-payment-instrument',
          description: 'Provider E asks for a payment instrument before it will create the mailbox.',
          waitingOn: 'operator',
          operatorNeeded: true,
          smallestUnblock:
            'Operator adds a payment instrument to the shared credential entry; nothing else about the walk changes.',
        },
      ],
      handover: null,
      evidence: [],
    },
    {
      id: 'item-provider-f-review',
      title: 'Wait out provider F approval queue',
      goal: 'Get the provider F account approved so the walk can be finished and reported.',
      state: 'blocked',
      blockers: [
        {
          id: 'blocker-approval-queue',
          description: 'Signup succeeded but the account sits in a manual approval queue.',
          waitingOn: 'provider',
          operatorNeeded: false,
          smallestUnblock: 'Re-check the account state after the stated review window and report either way.',
        },
      ],
      handover: null,
      evidence: [],
    },
    {
      id: 'item-walk-provider-a',
      title: 'Walk mailbox provider A end to end',
      goal: 'Publish the first measured entry on the mailbox shelf.',
      state: 'completed',
      blockers: [],
      handover: {
        recordedAt: '2026-08-19',
        summary: 'Walked, proved and reported. The entry is live with a five-step recipe.',
        learned: 'The signup form rejects an address it has seen before, so the first attempt burns the address.',
        resumeWith: 'Nothing outstanding. Reuse the recipe as the shape for later walks.',
      },
      evidence: [
        {
          id: 'evidence-walk-a-entry',
          label: 'Published Atlas entry',
          reference: 'atlas/mailbox/provider-a',
        },
      ],
    },
    {
      id: 'item-walk-provider-b',
      title: 'Walk mailbox provider B end to end',
      goal: 'Publish a second measured entry, including the wall that stopped the first attempt.',
      state: 'completed',
      blockers: [],
      handover: null,
      evidence: [
        {
          id: 'evidence-walk-b-entry',
          label: 'Published Atlas entry, refused outcome',
          reference: 'atlas/mailbox/provider-b',
        },
      ],
    },
    {
      id: 'item-vote-on-notes',
      title: 'Vote on the provider notes left by other walkers',
      goal: 'Say whether each note held when walked, so the shelf ordering reflects reality.',
      state: 'ready',
      blockers: [],
      handover: null,
      evidence: [],
    },
  ],
  recommendation: {
    workItemId: 'item-draft-shelf-playbook',
    reason:
      'It is the only active item, it is unblocked, and its handover names the exact next edit — so it converts into progress faster than starting a fresh walk.',
  },
}
