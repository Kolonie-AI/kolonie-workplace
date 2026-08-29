<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Data reaches this component only through TaskGateway.
 */
import { computed } from 'vue'
import type { WorkItemSummary } from '@/domain/workplace'
import {
  checklistProgress,
  dueDateState,
  initialsOf,
  readableTextOn,
  relativeDueDate,
} from '@/kanban/card-facets'

const props = defineProps<{
  item: WorkItemSummary
  selected: boolean
  moving: boolean
  lifted?: boolean
  now: Date
}>()

const emit = defineEmits<{
  select: [itemId: string]
}>()

const isBlocked = computed(() => props.item.lane === 'blocked')
const isReview = computed(() => props.item.lane === 'review')
const labels = computed(() => props.item.labels ?? [])
const assignees = computed(() => props.item.assignees ?? [])
const checklist = computed(() => props.item.checklist ?? [])
const comments = computed(() => props.item.comments ?? [])
const attachments = computed(() => props.item.attachments ?? [])
const dueState = computed(() => dueDateState(props.item.dueDate ?? null, props.now))
const dueLabel = computed(() => relativeDueDate(props.item.dueDate ?? null, props.now))
const progress = computed(() => checklistProgress(checklist.value))
const hasDescription = computed(() => (props.item.description ?? '').trim() !== '')
const coverKind = computed<'image' | 'colour' | null>(() => {
  if (props.item.coverImageUrl) {
    return 'image'
  }

  if (props.item.coverColour) {
    return 'colour'
  }

  return null
})
const showsBadges = computed(
  () =>
    hasDescription.value ||
    dueState.value !== null ||
    progress.value !== null ||
    comments.value.length > 0 ||
    attachments.value.length > 0 ||
    assignees.value.length > 0,
)

const commentLabel = computed(() =>
  comments.value.length === 1 ? '1 comment' : `${comments.value.length} comments`,
)
const attachmentLabel = computed(() =>
  attachments.value.length === 1 ? '1 attachment' : `${attachments.value.length} attachments`,
)
const dueAccessible = computed(() =>
  dueLabel.value === null ? null : `Due ${dueLabel.value}`,
)

function labelStyle(colour: string): { background: string; color: string } {
  return {
    background: colour,
    color: readableTextOn(colour),
  }
}

function onDragStart(event: DragEvent): void {
  event.dataTransfer?.setData('text/plain', props.item.id)

  if (event.dataTransfer !== null) {
    event.dataTransfer.effectAllowed = 'move'
  }
}
</script>

<template>
  <div class="kanban-card-shell">
    <button
      class="kanban-card"
      type="button"
      draggable="true"
      data-testid="kanban-card"
      :data-item-id="item.id"
      :data-blocked="isBlocked ? 'true' : 'false'"
      :data-selected="selected ? 'true' : 'false'"
      :data-lifted="lifted ? 'true' : 'false'"
      :data-cover-colour="item.coverColour ?? undefined"
      :aria-pressed="selected"
      :aria-busy="moving"
      @click="emit('select', item.id)"
      @dragstart="onDragStart"
    >
      <span
        v-if="coverKind !== null"
        class="kanban-card__cover"
        data-testid="kanban-card-cover"
        :data-cover-kind="coverKind"
        :style="coverKind === 'colour' ? { background: item.coverColour ?? undefined } : undefined"
      >
        <img
          v-if="coverKind === 'image' && item.coverImageUrl !== null"
          class="kanban-card__cover-image"
          :src="item.coverImageUrl"
          alt=""
        >
      </span>
      <span
        v-if="labels.length > 0"
        class="kanban-card__labels"
      >
        <span
          v-for="label in labels"
          :key="label.id"
          class="kanban-card__label"
          data-testid="kanban-card-label"
          role="img"
          :aria-label="label.title"
          :style="labelStyle(label.colour)"
        />
      </span>
      <span class="kanban-card__title">{{ item.title }}</span>
      <span
        v-if="isBlocked"
        class="kanban-card__flag"
        data-testid="kanban-card-blocked"
        role="status"
        aria-label="Blocked"
      >Blocked</span>
      <span
        v-else-if="isReview"
        class="kanban-card__flag kanban-card__flag--review"
        data-testid="kanban-card-review"
        role="status"
        aria-label="Review"
      >Review</span>
      <span
        v-if="showsBadges"
        class="kanban-card__footer"
        data-testid="kanban-card-badges"
      >
        <span
          v-if="hasDescription"
          class="kanban-card__count"
          data-testid="kanban-card-description"
          aria-label="Has a description"
        >
          <svg
            class="kanban-card__badge-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              d="M4 3h8v10H4z M6 6h4 M6 8.5h4 M6 11h2"
            />
          </svg>
        </span>
        <time
          v-if="dueState !== null && item.dueDate !== null && dueAccessible !== null"
          class="kanban-card__due"
          data-testid="kanban-card-due"
          :data-due-state="dueState"
          :datetime="item.dueDate"
          :aria-label="dueAccessible"
        >{{ dueLabel }}</time>
        <span
          v-if="attachments.length > 0"
          class="kanban-card__count"
          data-testid="kanban-card-attachments"
          :aria-label="attachmentLabel"
        >
          <svg
            class="kanban-card__badge-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.5"
              d="M10 6.5 6.5 10a2 2 0 0 0 2.8 2.8l4-4a3.2 3.2 0 0 0-4.5-4.5L5 8"
            />
          </svg>
          {{ attachments.length }}
        </span>
        <span
          v-if="progress !== null"
          class="kanban-card__checklist"
          data-testid="kanban-card-checklist"
          :aria-label="`Checklist ${progress.done}/${progress.total}`"
        >
          <svg
            class="kanban-card__badge-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              d="M3 4h3v3H3z M8 5.5h5 M3 10h3v3H3z M8 11.5h5"
            />
          </svg>
          {{ progress.done }}/{{ progress.total }}
        </span>
        <span
          v-if="comments.length > 0"
          class="kanban-card__count"
          data-testid="kanban-card-comments"
          :aria-label="commentLabel"
        >
          <svg
            class="kanban-card__badge-icon"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              d="M3 4h10v7H7l-3 3z"
            />
          </svg>
          {{ comments.length }}
        </span>
        <span
          v-if="assignees.length > 0"
          class="kanban-card__assignees"
        >
          <span
            v-for="assignee in assignees"
            :key="assignee.id"
            class="kanban-card__assignee"
            data-testid="kanban-card-assignee"
            :aria-label="assignee.name"
            :title="assignee.name"
          >{{ initialsOf(assignee.name) }}</span>
        </span>
      </span>
    </button>
  </div>
</template>
