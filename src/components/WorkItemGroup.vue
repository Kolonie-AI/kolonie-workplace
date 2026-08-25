<script setup lang="ts">
import type { WorkItem, WorkItemState } from '@/domain/workplace'

defineProps<{
  state: WorkItemState
  label: string
  items: readonly WorkItem[]
  selectedId: string | null
}>()

defineEmits<{ select: [id: string] }>()
</script>

<template>
  <section
    class="group"
    :data-testid="`work-item-group-${state}`"
    :aria-label="label"
  >
    <h3>{{ label }} ({{ items.length }})</h3>
    <p v-if="items.length === 0">
      Nothing here.
    </p>
    <ul
      v-else
      class="group__list"
    >
      <li
        v-for="item in items"
        :key="item.id"
        data-testid="work-item"
      >
        <button
          type="button"
          class="group__item"
          :class="{ 'group__item--selected': item.id === selectedId }"
          :aria-pressed="item.id === selectedId"
          @click="$emit('select', item.id)"
        >
          <span class="group__title">{{ item.title }}</span>
          <span
            v-if="item.blockers.some((blocker) => blocker.operatorNeeded)"
            class="group__flag"
          >operator needed</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.group__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.group__item {
  inline-size: 100%;
  text-align: start;
  cursor: pointer;
  padding: 0.6rem;
  border: 1px solid #c9ced6;
  border-radius: 6px;
  background: #ffffff;
  display: grid;
  gap: 0.25rem;
}

.group__item--selected {
  border-color: #1f3a5f;
  box-shadow: 0 0 0 2px #1f3a5f33;
}

.group__title {
  font-weight: 600;
}

.group__flag {
  font-size: 0.8rem;
  color: #8a3d00;
}
</style>
