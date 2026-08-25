<script setup lang="ts">
import type { WorkItem } from '@/domain/workplace'

defineProps<{ item: WorkItem }>()
</script>

<template>
  <section
    class="detail"
    data-testid="work-item-detail"
    :aria-label="`Details for ${item.title}`"
  >
    <h3>{{ item.title }}</h3>
    <p class="detail__goal">
      {{ item.goal }}
    </p>
    <p class="detail__state">
      State: {{ item.state }}
    </p>

    <div v-if="item.blockers.length > 0">
      <h4>Blocked by</h4>
      <ul>
        <li
          v-for="blocker in item.blockers"
          :key="blocker.id"
          data-testid="blocker"
        >
          <p>{{ blocker.description }}</p>
          <p>Waiting on: {{ blocker.waitingOn }}</p>
          <p
            v-if="blocker.operatorNeeded"
            class="detail__operator-needed"
            data-testid="operator-needed"
          >
            Operator needed
          </p>
          <p>Smallest unblock: {{ blocker.smallestUnblock }}</p>
        </li>
      </ul>
    </div>

    <div v-if="item.handover !== null">
      <h4>Latest handover</h4>
      <p data-testid="handover-recorded-at">
        Recorded {{ item.handover.recordedAt }}
      </p>
      <p data-testid="handover-summary">
        {{ item.handover.summary }}
      </p>
      <p data-testid="handover-learned">
        {{ item.handover.learned }}
      </p>
      <p data-testid="handover-resume-with">
        {{ item.handover.resumeWith }}
      </p>
    </div>
    <p
      v-else
      data-testid="handover-absent"
    >
      No handover recorded for this item.
    </p>

    <div v-if="item.evidence.length > 0">
      <h4>Evidence</h4>
      <ul>
        <li
          v-for="evidence in item.evidence"
          :key="evidence.id"
          data-testid="evidence-item"
        >
          {{ evidence.label }} — {{ evidence.reference }}
        </li>
      </ul>
    </div>
    <p
      v-else
      data-testid="evidence-absent"
    >
      No evidence recorded for this item.
    </p>
  </section>
</template>

<style scoped>
.detail {
  border: 1px solid #c9ced6;
  border-radius: 6px;
  padding: 1rem;
}

.detail__operator-needed {
  font-weight: 700;
  color: #8a3d00;
}
</style>
