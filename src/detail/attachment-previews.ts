import type { AttachmentId, WorkItemAttachment, WorkItemId } from '@/domain/workplace'

const previewUrls = new Map<string, string>()

function previewKey(itemId: WorkItemId, attachmentId: AttachmentId): string {
  return `${itemId}:${attachmentId}`
}

export function isImageAttachment(attachment: WorkItemAttachment): boolean {
  return attachment.mimeType.startsWith('image/')
}

export function previewUrlFor(
  itemId: WorkItemId,
  attachment: WorkItemAttachment,
): string | null {
  if (attachment.file === undefined || !isImageAttachment(attachment)) {
    return null
  }

  const key = previewKey(itemId, attachment.id)
  const existing = previewUrls.get(key)

  if (existing !== undefined) {
    return existing
  }

  const url = URL.createObjectURL(attachment.file)
  previewUrls.set(key, url)
  return url
}

export function revokePreview(itemId: WorkItemId, attachmentId: AttachmentId): void {
  const key = previewKey(itemId, attachmentId)
  const url = previewUrls.get(key)

  if (url === undefined) {
    return
  }

  URL.revokeObjectURL(url)
  previewUrls.delete(key)
}

export function revokeAllPreviews(): void {
  for (const url of previewUrls.values()) {
    URL.revokeObjectURL(url)
  }

  previewUrls.clear()
}
