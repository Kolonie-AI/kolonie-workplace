<script setup lang="ts">
/*
 * Copyright 2018-present Vikunja and contributors. All rights reserved.
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Per-lane composer placement is adapted for Kolonie Workplace on 2026-08-27
 * from Vikunja 2.5.0 (ef2200e9429c5cc42f5c1811433418bfcc72b3aa):
 *   frontend/src/components/project/views/ProjectKanban.vue
 */
import { WORKPLACE_LANE_LABELS, type Lane } from '@/domain/lanes'
import type { WorkItemId } from '@/domain/workplace'
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
 * A card moves between those fixed lanes by being dropped on a target lane, or
 * through the labelled keyboard control on the card. Within-lane order is not
 * modelled. Selecting a card still writes nothing. Creating a card is emitted
 * to the shell so TaskGateway remains the only write seam.
 */
defineProps<{
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
  move: [itemId: WorkItemId, lane: Lane]
  create: [title: string, lane: Lane]
}>()

function onDrop(event: DragEvent, lane: Lane): void {
  const itemId = event.dataTransfer?.getData('text/plain')

  if (itemId === undefined || itemId === '') {
    return
  }

  emit('move', itemId, lane)
}

function onCardMove(itemId: WorkItemId, lane: Lane): void {
  emit('move', itemId, lane)
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

      <p
        v-if="!isBoardEmpty && !isFilterEmpty"
        class="kanban__move-hint"
        data-testid="kanban-move-hint"
      >
        Drag a card onto another lane, or choose a lane with Move to lane. Lanes
        themselves cannot be added, renamed or removed.
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
          @dragover.prevent
          @drop.prevent="onDrop($event, column.lane)"
        >
          <h3 class="kanban__lane-title">
            <span>{{ WORKPLACE_LANE_LABELS[column.lane] }}</span>
            <span
              class="kanban__lane-count"
              data-testid="kanban-lane-count"
            >{{ column.items.length }}</span>
          </h3>

          <p
            v-if="column.items.length === 0"
            class="kanban__lane-empty"
            data-testid="kanban-lane-empty"
          >
            Nothing in this lane.
          </p>

          <ul
            v-else
            class="kanban__cards"
          >
            <li
              v-for="item in column.items"
              :key="item.id"
            >
              <KanbanCard
                :item="item"
                :selected="selectedItemId === item.id"
                :moving="movingItemId === item.id"
                :now="now"
                @select="emit('select', $event)"
                @move="onCardMove"
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
