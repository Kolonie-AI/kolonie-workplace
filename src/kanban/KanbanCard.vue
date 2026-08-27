<script setup lang="ts">
import { computed } from 'vue'
import { isLane, WORKPLACE_LANE_LABELS, WORKPLACE_LANES, type Lane } from '@/domain/lanes'
import type { WorkItemSummary } from '@/domain/workplace'

/**
 * The compact card. It carries a title, an owner and one status marker; a
 * description body, comments, attachments and every other field of a work item
 * belong to the detail pane, which is a separate surface.
 *
 * Clicking the card selects it and writes nothing. The card also has exactly
 * one write: it can be dragged onto another lane, and the labelled lane control
 * beside it does the same thing for anyone not using a pointer. Neither
 * reorders a lane, renames one, or edits any other field of the item.
 */
const props = defineProps<{
  item: WorkItemSummary
  selected: boolean
  moving: boolean
}>()

const emit = defineEmits<{
  select: [itemId: string]
  move: [itemId: string, lane: Lane]
}>()

const isBlocked = computed(() => props.item.lane === 'blocked')
const moveControlId = computed(() => `kanban-move-${props.item.id}`)

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
      :aria-pressed="selected"
      :aria-busy="moving"
      @click="emit('select', item.id)"
      @dragstart="onDragStart"
    >
      <span class="kanban-card__title">{{ item.title }}</span>
      <span class="kanban-card__meta">
        <span class="kanban-card__owner">{{ item.owner }}</span>
        <span
          v-if="isBlocked"
          class="kanban-card__flag"
          data-testid="kanban-card-blocked"
        >Blocked</span>
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
