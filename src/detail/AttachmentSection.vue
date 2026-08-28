<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { computed, useTemplateRef, watch } from 'vue'
import type {
  AttachmentId,
  CreateAttachmentInput,
  WorkItemAttachment,
} from '@/domain/workplace'
import {
  isImageAttachment,
  previewUrlFor,
  revokeUnusedPreviews,
} from '@/detail/attachment-previews'

const props = defineProps<{
  attachments: readonly WorkItemAttachment[]
  coverAttachmentId: AttachmentId | null
  showsPreviewData: boolean
}>()

const emit = defineEmits<{
  add: [input: CreateAttachmentInput]
  remove: [attachmentId: AttachmentId]
  setCover: [attachmentId: AttachmentId, imageUrl: string]
}>()

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const rows = computed(() =>
  props.attachments.map((attachment) => ({
    attachment,
    previewUrl: previewUrlFor(attachment),
    isCover: props.coverAttachmentId === attachment.id,
    isImage: isImageAttachment(attachment),
  })),
)

watch(
  () => props.attachments,
  (attachments) => {
    revokeUnusedPreviews(attachments)
  },
  { immediate: true },
)

function openPicker(): void {
  fileInput.value?.click()
}

defineExpose({ openPicker })

function addFiles(fileList: FileList | null | undefined): void {
  if (fileList === undefined || fileList === null) {
    return
  }

  for (const file of fileList) {
    emit('add', {
      name: file.name,
      size: file.size,
      mimeType: file.type === '' ? 'application/octet-stream' : file.type,
      file,
    })
  }
}

function onPickerChange(event: Event): void {
  const input = event.target as HTMLInputElement
  addFiles(input.files)
  input.value = ''
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  event.stopPropagation()
  addFiles(event.dataTransfer?.files)
}

function formatSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }

  return `${Math.round(size / 1024)} KB`
}

function setCover(attachmentId: AttachmentId, imageUrl: string | null): void {
  if (imageUrl === null) {
    return
  }

  emit('setCover', attachmentId, imageUrl)
}
</script>

<template>
  <section
    class="detail-pane__section"
    data-testid="detail-attachments"
    aria-label="Attachments"
    @dragover.prevent
    @drop="onDrop"
  >
    <div class="detail-attachments__header">
      <h3 class="detail-pane__section-title">
        Attachments
      </h3>
      <button
        class="detail-attachments__add"
        type="button"
        aria-label="Add an attachment"
        @click="openPicker"
      >
        Add
      </button>
    </div>

    <p
      v-if="showsPreviewData"
      class="detail-pane__empty"
      data-testid="detail-attachment-preview-notice"
    >
      Preview data. Files stay in this session and are not uploaded.
    </p>

    <input
      ref="fileInput"
      class="detail-attachments__file"
      type="file"
      aria-label="Attach a file"
      @change="onPickerChange"
    >

    <h4
      v-if="rows.length > 0"
      class="detail-attachments__files-title"
    >
      Files
    </h4>

    <p
      v-if="rows.length === 0"
      class="detail-pane__empty"
      data-testid="detail-attachments-empty"
    >
      No attachments yet.
    </p>

    <ul
      v-else
      class="detail-attachments__list"
    >
      <li
        v-for="row in rows"
        :key="row.attachment.id"
        class="detail-attachments__item"
        data-testid="detail-attachment"
        :data-attachment-id="row.attachment.id"
      >
        <img
          v-if="row.previewUrl !== null"
          class="detail-attachments__preview"
          data-testid="detail-attachment-preview"
          :src="row.previewUrl"
          alt=""
        >
        <span
          v-else
          class="detail-attachments__icon"
          aria-hidden="true"
        >File</span>
        <div class="detail-attachments__meta">
          <span class="detail-attachments__name">{{ row.attachment.name }}</span>
          <span class="detail-attachments__size">{{ formatSize(row.attachment.size) }}</span>
          <span
            v-if="row.isCover"
            class="detail-attachments__cover-mark"
          >Cover</span>
        </div>
        <button
          v-if="row.isImage && row.previewUrl !== null && !row.isCover"
          class="detail-attachments__cover"
          type="button"
          @click="setCover(row.attachment.id, row.previewUrl)"
        >
          Set as cover
        </button>
        <button
          class="detail-attachments__remove"
          type="button"
          @click="emit('remove', row.attachment.id)"
        >
          Remove attachment
        </button>
      </li>
    </ul>
  </section>
</template>
