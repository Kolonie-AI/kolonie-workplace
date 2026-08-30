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

export class WorkplaceCitizenRequired extends Error {
  constructor() {
    super('Kolonie Workplace: pick a linked citizen before calling the Colony.')
    this.name = 'WorkplaceCitizenRequired'
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
