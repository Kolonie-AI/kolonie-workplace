export class WorkplaceUnauthorized extends Error {
  constructor() {
    super('Kolonie Workplace: the session has expired. Sign in again.')
    this.name = 'WorkplaceUnauthorized'
  }
}

export class WorkplaceForbidden extends Error {
  constructor() {
    super(
      'Kolonie Workplace: this origin is not allowed to call the Colony. ' +
        'This is a deployment error, not a sign-in problem.',
    )
    this.name = 'WorkplaceForbidden'
  }
}

export class WorkplaceConflict extends Error {
  constructor() {
    super('That card has changed. It is back in its canonical lane.')
    this.name = 'WorkplaceConflict'
  }
}

export class WorkplaceInvalidTransition extends Error {
  constructor() {
    super('Kolonie Workplace: that lifecycle transition is not legal from this lane.')
    this.name = 'WorkplaceInvalidTransition'
  }
}

export class WorkplaceLifecycleInputRequired extends Error {
  constructor(field: 'blocker' | 'outcome') {
    super(
      field === 'blocker'
        ? 'Kolonie Workplace: blocking a card requires what blocks it and what will unblock it.'
        : 'Kolonie Workplace: completing a card requires an outcome.',
    )
    this.name = 'WorkplaceLifecycleInputRequired'
  }
}

export class WorkplaceMultipleOwnersUnsupported extends Error {
  constructor() {
    super('Kolonie Workplace: a live card has one owner, never multiple assignees.')
    this.name = 'WorkplaceMultipleOwnersUnsupported'
  }
}

export class WorkplaceHandoverRequired extends Error {
  constructor() {
    super('Kolonie Workplace: changing the owner requires a structured handover.')
    this.name = 'WorkplaceHandoverRequired'
  }
}

export class WorkplaceCitizenRequired extends Error {
  constructor() {
    super('Kolonie Workplace: pick a linked citizen before calling the Colony.')
    this.name = 'WorkplaceCitizenRequired'
  }
}

export class WorkplaceLinkUnresolvable extends Error {
  constructor() {
    super('Kolonie Workplace: nothing matches that kind and ref.')
    this.name = 'WorkplaceLinkUnresolvable'
  }
}

export class AttachmentPreviewOnly extends Error {
  constructor() {
    super(
      'Kolonie Workplace: attachments stay on the preview path. ' +
        'The live door does not accept file bytes.',
    )
    this.name = 'AttachmentPreviewOnly'
  }
}
