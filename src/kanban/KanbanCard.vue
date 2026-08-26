<script setup lang="ts">
import { computed } from 'vue'
import type { WorkItemSummary } from '@/domain/workplace'

/**
 * The compact card, and deliberately nothing more. It carries a title, an owner
 * and one status marker; a description body, comments, attachments and every
 * other field of a work item belong to the detail pane, which is a separate
 * surface. Clicking it selects — there is no edit, no status control and no
 * drag handle, because the first cut has no write path at all.
 */
const props = defineProps<{
  item: WorkItemSummary
  selected: boolean
}>()

const emit = defineEmits<{
  select: [itemId: string]
}>()

const isBlocked = computed(() => props.item.lane === 'blocked')
</script>

<template>
  <button
    class="kanban-card"
    type="button"
    data-testid="kanban-card"
    :data-item-id="item.id"
    :data-blocked="isBlocked ? 'true' : 'false'"
    :data-selected="selected ? 'true' : 'false'"
    :aria-pressed="selected"
    @click="emit('select', item.id)"
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
</template>
