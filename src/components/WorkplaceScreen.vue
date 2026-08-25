<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { TaskGateway } from '@/gateway/TaskGateway'
import type { WorkItemState, Workplace } from '@/domain/workplace'
import { resolveRecommendation } from '@/domain/recommendation'
import RecommendationPanel from '@/components/RecommendationPanel.vue'
import WorkItemGroup from '@/components/WorkItemGroup.vue'
import WorkItemDetail from '@/components/WorkItemDetail.vue'

const props = defineProps<{ gateway: TaskGateway }>()

const workplace = ref<Workplace | null>(null)
const loadFailed = ref(false)
const selectedId = ref<string | null>(null)

const groups: readonly { state: WorkItemState; label: string }[] = [
  { state: 'ready', label: 'Ready' },
  { state: 'active', label: 'Active' },
  { state: 'blocked', label: 'Blocked' },
  { state: 'completed', label: 'Completed' },
]

const recommendation = computed(() =>
  workplace.value === null
    ? null
    : resolveRecommendation(workplace.value.recommendation, workplace.value.workItems),
)

const selectedItem = computed(() => {
  if (workplace.value === null || selectedId.value === null) return null
  return workplace.value.workItems.find((item) => item.id === selectedId.value) ?? null
})

function itemsIn(state: WorkItemState) {
  return workplace.value === null ? [] : workplace.value.workItems.filter((item) => item.state === state)
}

onMounted(async () => {
  try {
    workplace.value = await props.gateway.loadWorkplace()
  } catch {
    loadFailed.value = true
  }
})
</script>

<template>
  <main class="workplace">
    <p
      v-if="loadFailed"
      data-testid="workplace-unavailable"
      role="alert"
    >
      The workplace state could not be loaded.
    </p>
    <p
      v-else-if="workplace === null"
      data-testid="workplace-loading"
    >
      Loading workplace…
    </p>

    <template v-else>
      <header class="workplace__identity">
        <h1>{{ workplace.citizen.displayName }}</h1>
        <p class="workplace__handle">
          {{ workplace.citizen.handle }}
        </p>
        <h2>{{ workplace.citizen.profession.title }}</h2>
        <p>{{ workplace.citizen.profession.summary }}</p>
        <h3>Mission</h3>
        <p>{{ workplace.citizen.mission.thesis }}</p>
        <p>{{ workplace.citizen.mission.horizon }}</p>
      </header>

      <section
        class="workplace__venture"
        aria-label="Active venture"
      >
        <h2>{{ workplace.venture.name }}</h2>
        <p>{{ workplace.venture.summary }}</p>
        <h3>{{ workplace.venture.milestone.title }}</h3>
        <p>{{ workplace.venture.milestone.outcome }}</p>
      </section>

      <RecommendationPanel
        v-if="recommendation !== null"
        :recommendation="recommendation"
        @open="selectedId = $event"
      />

      <div class="workplace__board">
        <WorkItemGroup
          v-for="group in groups"
          :key="group.state"
          :state="group.state"
          :label="group.label"
          :items="itemsIn(group.state)"
          :selected-id="selectedId"
          @select="selectedId = $event"
        />
      </div>

      <WorkItemDetail
        v-if="selectedItem !== null"
        :item="selectedItem"
      />
      <p
        v-else
        data-testid="no-item-selected"
      >
        Select a work item to see its detail.
      </p>
    </template>
  </main>
</template>

<style scoped>
.workplace {
  display: grid;
  gap: 1.5rem;
  max-inline-size: 70rem;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: system-ui, sans-serif;
  color: #1c1f24;
}

.workplace__handle {
  color: #5a6270;
}

.workplace__venture {
  border-inline-start: 4px solid #1f3a5f;
  padding-inline-start: 1rem;
}

.workplace__board {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
}
</style>
