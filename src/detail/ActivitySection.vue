<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { computed, ref, watch, type ComponentPublicInstance } from 'vue'
import type { CommentId, WorkItemComment } from '@/domain/workplace'
import { initialsOf, relativeTimestamp } from '@/kanban/card-facets'
import { sanitizeDescription } from '@/detail/sanitize-description'

const props = defineProps<{
  comments: readonly WorkItemComment[]
  currentHumanName: string | null
  now: Date
}>()

const emit = defineEmits<{
  create: [body: string]
  update: [commentId: CommentId, body: string]
  remove: [commentId: CommentId]
}>()

const draft = ref('')
const editingId = ref<CommentId | null>(null)
const editDraft = ref('')
const confirmDeleteId = ref<CommentId | null>(null)

const ordered = computed(() =>
  [...props.comments].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  ),
)

function renderMarkup(
  element: Element | ComponentPublicInstance | null,
  body: string,
): void {
  if (element instanceof HTMLElement) {
    element.innerHTML = sanitizeDescription(body)
  }
}

function isOwn(comment: WorkItemComment): boolean {
  return props.currentHumanName !== null && comment.author === props.currentHumanName
}

watch(
  () => props.comments.length,
  (next, previous) => {
    if (next > previous) {
      draft.value = ''
    }
  },
)

function submit(): void {
  const body = sanitizeDescription(draft.value)

  if (body.trim() === '') {
    return
  }

  emit('create', body)
}

function startEdit(comment: WorkItemComment): void {
  editingId.value = comment.id
  editDraft.value = comment.body
  confirmDeleteId.value = null
}

function cancelEdit(): void {
  editingId.value = null
  editDraft.value = ''
}

function saveEdit(comment: WorkItemComment): void {
  const body = sanitizeDescription(editDraft.value)

  if (body.trim() === '' || body === comment.body) {
    cancelEdit()
    return
  }

  emit('update', comment.id, body)
  cancelEdit()
}

function requestDelete(comment: WorkItemComment): void {
  confirmDeleteId.value = comment.id
  editingId.value = null
}

function cancelDelete(): void {
  confirmDeleteId.value = null
}

function confirmDelete(comment: WorkItemComment): void {
  emit('remove', comment.id)
  confirmDeleteId.value = null
}
</script>

<template>
  <section
    class="detail-pane__section"
    data-testid="detail-activity"
    aria-label="Comments and activity"
  >
    <h3 class="detail-pane__section-title">
      Comments and activity
    </h3>

    <p
      v-if="ordered.length === 0"
      class="detail-pane__empty"
      data-testid="detail-activity-empty"
    >
      No comments yet.
    </p>

    <ul
      v-else
      class="detail-activity__list"
    >
      <li
        v-for="comment in ordered"
        :key="comment.id"
        class="detail-activity__item"
        data-testid="detail-comment"
        :data-comment-id="comment.id"
      >
        <span
          class="detail-activity__avatar"
          :aria-hidden="true"
        >{{ initialsOf(comment.author) }}</span>
        <div class="detail-activity__body">
          <p class="detail-activity__meta">
            <span class="detail-activity__author">{{ comment.author }}</span>
            <time
              class="detail-activity__time"
              :datetime="comment.createdAt"
            >{{ relativeTimestamp(comment.createdAt, now) }}</time>
          </p>
          <template v-if="editingId === comment.id">
            <textarea
              v-model="editDraft"
              class="detail-activity__composer"
              aria-label="Edit comment"
            />
            <div class="detail-activity__actions">
              <button
                class="detail-activity__submit"
                type="button"
                @click="saveEdit(comment)"
              >
                Save edit
              </button>
              <button
                class="detail-activity__cancel"
                type="button"
                @click="cancelEdit"
              >
                Cancel edit
              </button>
            </div>
          </template>
          <div
            v-else
            :ref="(element) => renderMarkup(element, comment.body)"
            class="detail-activity__markup"
            data-testid="detail-comment-body"
          />
          <div
            v-if="isOwn(comment) && editingId !== comment.id"
            class="detail-activity__actions"
          >
            <template v-if="confirmDeleteId === comment.id">
              <button
                class="detail-activity__delete"
                type="button"
                @click="confirmDelete(comment)"
              >
                Confirm delete comment
              </button>
              <button
                class="detail-activity__cancel"
                type="button"
                @click="cancelDelete"
              >
                Cancel delete
              </button>
            </template>
            <template v-else>
              <button
                class="detail-activity__edit"
                type="button"
                @click="startEdit(comment)"
              >
                Edit comment
              </button>
              <button
                class="detail-activity__delete"
                type="button"
                @click="requestDelete(comment)"
              >
                Delete comment
              </button>
            </template>
          </div>
        </div>
      </li>
    </ul>

    <div class="detail-activity__compose">
      <textarea
        v-model="draft"
        class="detail-activity__composer"
        placeholder="Write a comment…"
        aria-label="Write a comment"
      />
      <button
        class="detail-activity__submit"
        type="button"
        @click="submit"
      >
        Save comment
      </button>
    </div>
  </section>
</template>
