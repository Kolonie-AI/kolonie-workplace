import type { AttachmentId, WorkItemAttachment } from '@/domain/workplace'

const previewUrls = new Map<AttachmentId, string>()

export function isImageAttachment(attachment: WorkItemAttachment): boolean {
  return attachment.mimeType.startsWith('image/')
}

export function previewUrlFor(attachment: WorkItemAttachment): string | null {
  if (attachment.file === undefined || !isImageAttachment(attachment)) {
    return null
  }

  const existing = previewUrls.get(attachment.id)

  if (existing !== undefined) {
    return existing
  }

  const url = URL.createObjectURL(attachment.file)
  previewUrls.set(attachment.id, url)
  return url
}

export function revokePreview(attachmentId: AttachmentId): void {
  const url = previewUrls.get(attachmentId)

  if (url === undefined) {
    return
  }

  URL.revokeObjectURL(url)
  previewUrls.delete(attachmentId)
}

export function revokeUnusedPreviews(attachments: readonly WorkItemAttachment[]): void {
  const keep = new Set(attachments.map((attachment) => attachment.id))

  for (const attachmentId of [...previewUrls.keys()]) {
    if (!keep.has(attachmentId)) {
      revokePreview(attachmentId)
    }
  }
}

export function revokeAllPreviews(): void {
  for (const url of previewUrls.values()) {
    URL.revokeObjectURL(url)
  }

  previewUrls.clear()
}
