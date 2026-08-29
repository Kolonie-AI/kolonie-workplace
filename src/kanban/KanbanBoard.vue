<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { ref } from 'vue'
import { WORKPLACE_LANE_LABELS, WORKPLACE_LANES, type Lane } from '@/domain/lanes'
import type { WorkItemId, WorkItemSummary } from '@/domain/workplace'
import type { InvalidLaneItem, LaneColumn } from '@/items/lane-columns'
import type { BoardItemsStatus } from '@/items/use-board-items'
import KanbanCard from '@/kanban/KanbanCard.vue'
import LaneComposer from '@/kanban/LaneComposer.vue'
import '@/kanban/kanban-board.css'

/**
 * Six lanes, always all six, always in the order the Colony defines. They are
 * status and not user-defined buckets, so this component renders `columns` as
 * given and offers no way to add, rename, reorder or delete one.
 *
 * A card reorders inside a lane or moves between those fixed lanes, by pointer
 * drop or by the arrow keys on the card. Lists themselves do not drag.
 * Selecting a card still writes nothing. Creating a card is emitted to the
 * shell so TaskGateway remains the only write seam. There is no list create
 * control and no standing drag instruction: the six wells are the board.
 */
const props = defineProps<{
  status: BoardItemsStatus
  columns: readonly LaneColumn[]
  invalid: readonly InvalidLaneItem[]
  isBoardEmpty: boolean
  isFilterEmpty: boolean
  selectedItemId: WorkItemId | null
  movingItemId: WorkItemId | null
  moveError: string | null
  createError: string | null
  now: Date
}>()

const emit = defineEmits<{
  select: [itemId: WorkItemId]
  move: [itemId: WorkItemId, lane: Lane, position?: number]
  reorder: [itemId: WorkItemId, lane: Lane, position: number]
  create: [title: string, lane: Lane]
}>()

type Placeholder = { readonly lane: Lane; readonly index: number }
type Slot =
  | { readonly kind: 'item'; readonly item: WorkItemSummary }
  | { readonly kind: 'placeholder' }

const draggingId = ref<WorkItemId | null>(null)
const placeholder = ref<Placeholder | null>(null)

function slotsOf(column: LaneColumn): readonly Slot[] {
  const slots: Slot[] = column.items.map((item) => ({ kind: 'item', item }))
  const current = placeholder.value

  if (current === null || current.lane !== column.lane) {
    return slots
  }

  const index = Math.max(0, Math.min(current.index, slots.length))
  const next = slots.slice()
  next.splice(index, 0, { kind: 'placeholder' })
  return next
}

function readItemId(event: DragEvent): WorkItemId | null {
  const itemId = event.dataTransfer?.getData('text/plain')
  return itemId === undefined || itemId === '' ? null : itemId
}

function findOrigin(itemId: WorkItemId): { lane: Lane; index: number } | null {
  for (const column of props.columns) {
    const index = column.items.findIndex((item) => item.id === itemId)
    if (index !== -1) {
      return { lane: column.lane, index }
    }
  }

  return null
}

function finishDrag(): void {
  draggingId.value = null
  placeholder.value = null
}

function commit(
  itemId: WorkItemId,
  origin: { lane: Lane; index: number },
  destLane: Lane,
  destIndex: number | null,
): void {
  if (origin.lane === destLane) {
    if (destIndex === null || destIndex === origin.index) {
      return
    }

    emit('reorder', itemId, destLane, destIndex)
    return
  }

  if (destIndex === null) {
    emit('move', itemId, destLane)
    return
  }

  emit('move', itemId, destLane, destIndex)
}

function onDragStart(event: DragEvent, itemId: WorkItemId): void {
  const origin = findOrigin(itemId)
  draggingId.value = itemId
  placeholder.value = origin

  if (event.dataTransfer !== null) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)
  }
}

function onLaneDragOver(event: DragEvent, lane: Lane, itemCount: number): void {
  event.preventDefault()

  if (event.dataTransfer !== null) {
    event.dataTransfer.dropEffect = 'move'
  }

  const card = (event.target as HTMLElement).closest('[data-testid="kanban-card"]')

  if (card !== null) {
    const itemId = card.getAttribute('data-item-id')
    const column = props.columns.find((entry) => entry.lane === lane)
    const index = column?.items.findIndex((item) => item.id === itemId) ?? itemCount
    placeholder.value = { lane, index: index === -1 ? itemCount : index }
    return
  }

  placeholder.value = { lane, index: itemCount }
}

function isCardPositionTarget(event: DragEvent): boolean {
  const target = event.target as HTMLElement
  if (target.closest('.kanban__lane-title') !== null || target.closest('.lane-composer') !== null) {
    return false
  }

  return (
    target.closest('[data-testid="kanban-card"]') !== null ||
    target.closest('[data-testid="kanban-drop-placeholder"]') !== null ||
    target.closest('[data-testid="kanban-cards"]') !== null ||
    target.closest('[data-testid="kanban-lane-empty"]') !== null
  )
}

function onDrop(event: DragEvent, destLane: Lane): void {
  const itemId = readItemId(event)
  const origin = itemId === null ? null : findOrigin(itemId)

  if (itemId === null || origin === null || !isCardPositionTarget(event)) {
    finishDrag()
    return
  }

  const target = event.target as HTMLElement
  const targetCard = target.closest('[data-testid="kanban-card"]')
  const targetPlaceholder = target.closest('[data-testid="kanban-drop-placeholder"]')
  const destColumn = props.columns.find((column) => column.lane === destLane)
  let destIndex: number | null = null

  if (targetCard !== null) {
    const destItemId = targetCard.getAttribute('data-item-id')
    const index = destColumn?.items.findIndex((item) => item.id === destItemId) ?? -1
    destIndex = index === -1 ? null : index
  } else if (
    placeholder.value?.lane === destLane &&
    (origin.lane === destLane || targetPlaceholder !== null)
  ) {
    destIndex = placeholder.value.index
  }

  commit(itemId, origin, destLane, destIndex)
  finishDrag()
}

function adjacentLane(lane: Lane, delta: number): Lane | null {
  const index = WORKPLACE_LANES.indexOf(lane)
  return WORKPLACE_LANES[index + delta] ?? null
}

function onCardKeydown(event: KeyboardEvent, item: WorkItemSummary, column: LaneColumn): void {
  const index = column.items.findIndex((entry) => entry.id === item.id)

  if (index === -1) {
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (index > 0) {
      emit('reorder', item.id, column.lane, index - 1)
    }
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (index < column.items.length - 1) {
      emit('reorder', item.id, column.lane, index + 1)
    }
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    const previous = adjacentLane(column.lane, -1)
    if (previous !== null) {
      emit('move', item.id, previous)
    }
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    const next = adjacentLane(column.lane, 1)
    if (next !== null) {
      emit('move', item.id, next)
    }
  }
}

</script>

<template>
  <div
    class="kanban"
    data-testid="kanban-board"
  >
    <p
      v-if="status === 'idle'"
      class="kanban__state"
      data-testid="kanban-no-board"
    >
      No board is open. Choose one of your boards to see its work items.
    </p>

    <p
      v-else-if="status === 'loading'"
      class="kanban__state kanban__state--loading"
      data-testid="kanban-loading"
    >
      Loading this board's work items…
    </p>

    <p
      v-else-if="status === 'error'"
      class="kanban__state kanban__state--error"
      data-testid="kanban-error"
      role="alert"
    >
      This board's work items could not be read. This is a failure to read them,
      not a statement about what the board holds.
    </p>

    <template v-else>
      <p
        v-if="moveError !== null"
        class="kanban__state kanban__state--error"
        data-testid="kanban-move-error"
        role="alert"
      >
        {{ moveError }}
      </p>

      <p
        v-if="createError !== null"
        class="kanban__state kanban__state--error"
        data-testid="kanban-create-error"
        role="alert"
      >
        {{ createError }}
      </p>

      <p
        v-if="invalid.length > 0"
        class="kanban__state kanban__state--error"
        data-testid="kanban-invalid"
        role="alert"
      >
        Invalid data: {{ invalid.length }} work item(s) report a status the Colony
        does not define, so they are shown here rather than placed in a lane.
        <span
          v-for="entry in invalid"
          :key="entry.item.id"
          class="kanban__invalid-item"
          data-testid="kanban-invalid-item"
          :data-item-id="entry.item.id"
        >{{ entry.item.title }} — reported status "{{ entry.reportedLane }}".</span>
      </p>

      <p
        v-if="isBoardEmpty"
        class="kanban__state"
        data-testid="kanban-board-empty"
      >
        This board holds no work items yet. Every lane below is empty because the
        board is empty, not because a lane is missing.
      </p>

      <p
        v-if="isFilterEmpty"
        class="kanban__state"
        data-testid="kanban-no-match"
      >
        No work item matches this filter. The board holds work — the filter is
        hiding it, so widening or clearing the filter brings it back.
      </p>

      <div
        class="kanban__lanes"
        data-testid="kanban-lanes"
      >
        <section
          v-for="column in columns"
          :key="column.lane"
          class="kanban__lane"
          data-testid="kanban-lane"
          :data-lane="column.lane"
          :aria-label="WORKPLACE_LANE_LABELS[column.lane]"
          @dragover.prevent="onLaneDragOver($event, column.lane, column.items.length)"
          @drop.prevent="onDrop($event, column.lane)"
        >
          <h3 class="kanban__lane-title">
            <span>{{ WORKPLACE_LANE_LABELS[column.lane] }}</span>
            <span
              class="kanban__lane-count"
              data-testid="kanban-lane-count"
            >{{ column.items.length }}</span>
          </h3>

          <div
            v-if="column.items.length === 0 && draggingId === null"
            class="kanban__lane-empty"
            data-testid="kanban-lane-empty"
          />

          <ul
            v-else
            class="kanban__cards"
            data-testid="kanban-cards"
          >
            <li
              v-for="(slot, index) in slotsOf(column)"
              :key="slot.kind === 'item' ? slot.item.id : `placeholder-${column.lane}-${index}`"
            >
              <div
                v-if="slot.kind === 'placeholder'"
                class="kanban__placeholder"
                data-testid="kanban-drop-placeholder"
              />
              <KanbanCard
                v-else
                :item="slot.item"
                :selected="selectedItemId === slot.item.id"
                :moving="movingItemId === slot.item.id"
                :lifted="draggingId === slot.item.id"
                :now="now"
                @select="emit('select', $event)"
                @dragstart="onDragStart($event, slot.item.id)"
                @dragend="finishDrag"
                @keydown="onCardKeydown($event, slot.item, column)"
              />
            </li>
          </ul>

          <LaneComposer
            :lane="column.lane"
            @create="emit('create', $event, column.lane)"
          />
        </section>
      </div>
    </template>
  </div>
</template>
