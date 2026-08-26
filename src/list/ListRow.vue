<script setup lang="ts">
import { computed } from 'vue'
import { WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type { ListRow } from '@/items/list-rows'

/**
 * One dense row, and deliberately nothing more. It carries a title, the lane,
 * an owner and one status marker; everything else about a work item belongs to
 * the detail pane, which is a separate surface. Clicking it selects — there is
 * no edit, no completion control and no reorder handle, because the first cut
 * has no write path at all.
 */
const props = defineProps<{
  row: ListRow
  selected: boolean
}>()

const emit = defineEmits<{
  select: [itemId: string]
}>()

const isBlocked = computed(() => props.row.lane === 'blocked')
const laneLabel = computed(() => WORKPLACE_LANE_LABELS[props.row.lane])
</script>

<template>
  <button
    class="list-row"
    type="button"
    data-testid="list-row"
    :data-item-id="row.item.id"
    :data-lane="row.lane"
    :data-blocked="isBlocked ? 'true' : 'false'"
    :data-selected="selected ? 'true' : 'false'"
    :aria-pressed="selected"
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
</template>
