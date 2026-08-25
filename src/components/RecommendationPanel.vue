<script setup lang="ts">
import type { ResolvedRecommendation } from '@/domain/recommendation'

defineProps<{ recommendation: ResolvedRecommendation }>()
defineEmits<{ open: [id: string] }>()
</script>

<template>
  <section
    v-if="recommendation.status === 'available'"
    class="panel panel--available"
    data-testid="recommendation"
    aria-label="Recommended next action"
  >
    <h2>Recommended next action</h2>
    <p
      class="panel__title"
      :data-testid="`recommended-${recommendation.item.id}`"
    >
      {{ recommendation.item.title }}
    </p>
    <p>{{ recommendation.item.goal }}</p>
    <p
      class="panel__reason"
      data-testid="recommendation-reason"
    >
      Why: {{ recommendation.reason }}
    </p>
    <button
      type="button"
      @click="$emit('open', recommendation.item.id)"
    >
      Open recommended item
    </button>
  </section>

  <section
    v-else
    class="panel panel--unavailable"
    data-testid="recommendation-unavailable"
    role="alert"
    aria-label="Recommended next action unavailable"
  >
    <h2>Recommended next action unavailable</h2>
    <p v-if="recommendation.cause === 'missing'">
      The Colony supplied no recommended action for this wake. Nothing has been chosen in its place.
    </p>
    <p v-else>
      The Colony recommended an unknown work item ({{ recommendation.workItemId }}). Nothing has been
      chosen in its place.
    </p>
    <p class="panel__note">
      Pick an item below deliberately, or wait for the Colony to supply a recommendation.
    </p>
  </section>
</template>

<style scoped>
.panel {
  border-radius: 6px;
  padding: 1rem;
  border: 2px solid;
}

.panel--available {
  border-color: #1f3a5f;
  background: #eef3fa;
}

.panel--unavailable {
  border-color: #8a3d00;
  background: #fdf1e6;
}

.panel__title {
  font-size: 1.1rem;
  font-weight: 700;
}

.panel__reason {
  font-style: italic;
}

.panel__note {
  font-size: 0.9rem;
}
</style>
