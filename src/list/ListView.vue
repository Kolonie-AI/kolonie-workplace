<script setup lang="ts">
import { WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type { WorkItemId } from '@/domain/workplace'
import type { InvalidLaneItem } from '@/items/lane-columns'
import type { ListRow as ListRowModel } from '@/items/list-rows'
import type { BoardItemsStatus } from '@/items/use-board-items'
import ListRow from '@/list/ListRow.vue'
import '@/list/list-view.css'

/**
 * The same items the Kanban renders, in a single dense vertical list.
 *
 * It receives rows rather than fetching them: both views are fed by one
 * `useBoardItems`, so this component cannot read differently, filter
 * differently or order into a different set than its sibling. The rows arrive
 * already ordered, and this component offers no way to reorder them — no sort
 * control, no column configuration, no filter bar.
 *
 * The list is read-only: no inline edit, no completion checkbox, no create-row
 * affordance. Selecting a row emits an id and writes nothing.
 */
defineProps<{
  status: BoardItemsStatus
  rows: readonly ListRowModel[]
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
    class="list-view"
    data-testid="list-view"
  >
    <p
      v-if="status === 'idle'"
      class="list-view__state"
      data-testid="list-no-board"
    >
      No board is open. Choose one of your boards to see its work items.
    </p>

    <p
      v-else-if="status === 'loading'"
      class="list-view__state list-view__state--loading"
      data-testid="list-loading"
    >
      Loading this board's work items…
    </p>

    <p
      v-else-if="status === 'error'"
      class="list-view__state list-view__state--error"
      data-testid="list-error"
      role="alert"
    >
      This board's work items could not be read. This is a failure to read them,
      not a statement about what the board holds.
    </p>

    <template v-else>
      <p
        v-if="invalid.length > 0"
        class="list-view__state list-view__state--error"
        data-testid="list-invalid"
        role="alert"
      >
        Invalid data: {{ invalid.length }} work item(s) report a status the Colony
        does not define, so they are shown here rather than placed in the list.
        <span
          v-for="entry in invalid"
          :key="entry.item.id"
          class="list-view__invalid-item"
          data-testid="list-invalid-item"
          :data-item-id="entry.item.id"
        >{{ entry.item.title }} — reported status "{{ entry.reportedLane }}".</span>
      </p>

      <p
        v-if="isBoardEmpty"
        class="list-view__state"
        data-testid="list-board-empty"
      >
        This board holds no work items yet. The list is empty because the board
        is empty, not because something was filtered out of it.
      </p>

      <ol
        v-else
        class="list-view__rows"
        data-testid="list-rows"
      >
        <li
          v-for="row in rows"
          :key="row.item.id"
          class="list-view__entry"
        >
          <p
            v-if="row.isLaneStart"
            class="list-view__lane-heading"
            data-testid="list-lane-heading"
            :data-lane="row.lane"
          >
            {{ WORKPLACE_LANE_LABELS[row.lane] }}
          </p>
          <ListRow
            :row="row"
            :selected="selectedItemId === row.item.id"
            @select="emit('select', $event)"
          />
        </li>
      </ol>
    </template>
  </div>
</template>
