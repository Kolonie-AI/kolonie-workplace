<script setup lang="ts">
import { computed } from 'vue'
import { isLane, WORKPLACE_LANE_LABELS, WORKPLACE_LANES, type Lane } from '@/domain/lanes'
import type { ListRow } from '@/items/list-rows'

/**
 * One dense row. It carries a title, the lane, an owner and one status marker;
 * everything else about a work item belongs to the detail pane, which is a
 * separate surface.
 *
 * Clicking the row selects it and writes nothing. The labelled lane control
 * beside it performs the same single write the Kanban card offers, through the
 * same loaded state, so the two views cannot disagree about lane membership.
 * It reorders nothing and edits no other field.
 */
const props = defineProps<{
  row: ListRow
  selected: boolean
  moving: boolean
}>()

const emit = defineEmits<{
  select: [itemId: string]
  move: [itemId: string, lane: Lane]
}>()

const isBlocked = computed(() => props.row.lane === 'blocked')
const laneLabel = computed(() => WORKPLACE_LANE_LABELS[props.row.lane])
const moveControlId = computed(() => `list-move-${props.row.item.id}`)

function onLaneChange(event: Event): void {
  const chosen = (event.target as HTMLSelectElement).value

  if (isLane(chosen)) {
    emit('move', props.row.item.id, chosen)
  }
}
</script>

<template>
  <div class="list-row-shell">
    <button
      class="list-row"
      type="button"
      data-testid="list-row"
      :data-item-id="row.item.id"
      :data-lane="row.lane"
      :data-blocked="isBlocked ? 'true' : 'false'"
      :data-selected="selected ? 'true' : 'false'"
      :aria-pressed="selected"
      :aria-busy="moving"
      @click="emit('select', row.item.id)"
    >
      <span class="list-row__title">{{ row.item.title }}</span>
      <span class="list-row__lane">{{ laneLabel }}</span>
      <span class="list-row__owner">{{ row.item.owner }}</span>
      <span
        v-if="isBlocked"
        class="list-row__flag"
        data-testid="list-row-blocked"
      >Blocked</span>
    </button>

    <div class="list-row__move">
      <label
        class="list-row__move-label"
        :for="moveControlId"
      >Move to lane</label>
      <select
        :id="moveControlId"
        class="list-row__move-control"
        data-testid="list-row-move"
        :data-item-id="row.item.id"
        :value="row.lane"
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
