<script setup lang="ts">
import { WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type { WorkItemId } from '@/domain/workplace'
import type { InvalidLaneItem, LaneColumn } from '@/kanban/lane-columns'
import type { BoardKanbanStatus } from '@/kanban/use-board-kanban'
import KanbanCard from '@/kanban/KanbanCard.vue'
import '@/kanban/kanban-board.css'

/**
 * Six lanes, always all six, always in the order the Colony defines. They are
 * status and not user-defined buckets, so this component renders `columns` as
 * given and offers no way to add, rename, reorder or delete one.
 *
 * The board is read-only: no drag-and-drop, no reorder handler, no `draggable`
 * attribute, no inline edit and no create affordance. Selecting a card emits an
 * id and writes nothing.
 */
defineProps<{
  status: BoardKanbanStatus
  columns: readonly LaneColumn[]
  invalid: readonly InvalidLaneItem[]
  isBoardEmpty: boolean
  selectedItemId: WorkItemId | null
}>()

const emit = defineEmits<{
  select: [itemId: WorkItemId]
}>()
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
      class="kanban__state"
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
                @select="emit('select', $event)"
              />
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
