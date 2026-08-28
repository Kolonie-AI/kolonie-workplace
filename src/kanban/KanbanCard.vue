<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Data reaches this component only through TaskGateway.
 */
import { computed } from 'vue'
import { isLane, WORKPLACE_LANE_LABELS, WORKPLACE_LANES, type Lane } from '@/domain/lanes'
import type { WorkItemSummary } from '@/domain/workplace'
import {
  WORK_ITEM_PRIORITY_LABELS,
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
  now: Date
}>()

const emit = defineEmits<{
  select: [itemId: string]
  move: [itemId: string, lane: Lane]
}>()

const isBlocked = computed(() => props.item.lane === 'blocked')
const moveControlId = computed(() => `kanban-move-${props.item.id}`)
const labels = computed(() => props.item.labels ?? [])
const assignees = computed(() => props.item.assignees ?? [])
const checklist = computed(() => props.item.checklist ?? [])
const comments = computed(() => props.item.comments ?? [])
const attachments = computed(() => props.item.attachments ?? [])
const dueState = computed(() => dueDateState(props.item.dueDate ?? null, props.now))
const dueLabel = computed(() => relativeDueDate(props.item.dueDate ?? null, props.now))
const progress = computed(() => checklistProgress(checklist.value))
const showsPriority = computed(
  () => props.item.priority !== undefined && props.item.priority !== 'unset',
)
const showsPercentDone = computed(() => props.item.percentDone > 0)
const showsCounts = computed(
  () => comments.value.length > 0 || attachments.value.length > 0,
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

function onLaneChange(event: Event): void {
  const chosen = (event.target as HTMLSelectElement).value

  if (isLane(chosen)) {
    emit('move', props.item.id, chosen)
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
      :data-cover-colour="item.coverColour ?? undefined"
      :aria-pressed="selected"
      :aria-busy="moving"
      @click="emit('select', item.id)"
      @dragstart="onDragStart"
    >
      <span
        v-if="item.coverColour"
        class="kanban-card__cover"
        data-testid="kanban-card-cover"
        :style="{ background: item.coverColour }"
      />
      <span class="kanban-card__title">{{ item.title }}</span>
      <span
        v-if="labels.length > 0"
        class="kanban-card__labels"
      >
        <span
          v-for="label in labels"
          :key="label.id"
          class="kanban-card__label"
          data-testid="kanban-card-label"
          :style="labelStyle(label.colour)"
        >{{ label.title }}</span>
      </span>
      <span class="kanban-card__meta">
        <span class="kanban-card__owner">{{ item.owner }}</span>
        <span
          v-if="isBlocked"
          class="kanban-card__flag"
          data-testid="kanban-card-blocked"
        >Blocked</span>
      </span>
      <progress
        v-if="showsPercentDone"
        class="kanban-card__progress"
        data-testid="kanban-card-progress"
        :value="item.percentDone"
        max="100"
      >
        {{ item.percentDone }}%
      </progress>
      <span
        v-if="assignees.length > 0 || showsPriority || dueState !== null || progress !== null || showsCounts"
        class="kanban-card__footer"
      >
        <span
          v-if="assignees.length > 0"
          class="kanban-card__assignees"
        >
          <span
            v-for="assignee in assignees"
            :key="assignee.id"
            class="kanban-card__assignee"
            data-testid="kanban-card-assignee"
            :title="assignee.name"
          >{{ initialsOf(assignee.name) }}</span>
        </span>
        <span
          v-if="showsPriority"
          class="kanban-card__priority"
          data-testid="kanban-card-priority"
          :data-priority="item.priority"
        >{{ WORK_ITEM_PRIORITY_LABELS[item.priority] }}</span>
        <time
          v-if="dueState !== null && item.dueDate !== null"
          class="kanban-card__due"
          data-testid="kanban-card-due"
          :data-due-state="dueState"
          :datetime="item.dueDate"
        >{{ dueLabel }}</time>
        <span
          v-if="progress !== null"
          class="kanban-card__checklist"
          data-testid="kanban-card-checklist"
        >{{ progress.done }}/{{ progress.total }}</span>
        <span
          v-if="showsCounts"
          class="kanban-card__counts"
          data-testid="kanban-card-counts"
        >
          <span
            v-if="comments.length > 0"
            class="kanban-card__count"
          >{{ comments.length }}</span>
          <span
            v-if="attachments.length > 0"
            class="kanban-card__count"
          >{{ attachments.length }}</span>
        </span>
      </span>
    </button>

    <div class="kanban-card__move">
      <label
        class="kanban-card__move-label"
        :for="moveControlId"
      >Move to lane</label>
      <select
        :id="moveControlId"
        class="kanban-card__move-control"
        data-testid="kanban-card-move"
        :data-item-id="item.id"
        :value="item.lane"
        :disabled="moving"
        @change="onLaneChange"
      >
        <option
          v-for="lane in WORKPLACE_LANES"
          :key="lane"
          :value="lane"
        >
          {{ WORKPLACE_LANE_LABELS[lane] }}
        </option>
      </select>
    </div>
  </div>
</template>
