<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { nextTick, useTemplateRef } from 'vue'
import type { CardEvent } from '@/domain/workplace'
import type { DetailReadStatus } from '@/detail/use-item-detail'
import {
  cardEventActorLabel,
  cardEventFieldSummary,
  cardEventRelated,
  cardEventVerbLabel,
} from '@/detail/card-history'
import { relativeTimestamp } from '@/kanban/card-facets'

const props = defineProps<{
  status: DetailReadStatus
  events: readonly CardEvent[]
  hasEarlier: boolean
  now: Date
}>()

void props
const emit = defineEmits<{
  loadEarlier: []
  retry: []
}>()

const loadEarlierButton = useTemplateRef<HTMLButtonElement>('loadEarlierButton')

async function loadEarlier(): Promise<void> {
  emit('loadEarlier')
  await nextTick()
  loadEarlierButton.value?.focus()
}
</script>

<template>
  <section
    class="detail-pane__section"
    data-testid="detail-history"
    aria-label="History"
  >
    <h3 class="detail-pane__section-title">
      History
    </h3>

    <p
      v-if="status === 'loading' && events.length === 0"
      class="detail-pane__empty"
      data-testid="detail-history-loading"
      role="status"
    >
      Loading history…
    </p>

    <p
      v-else-if="status === 'error'"
      class="detail-pane__state detail-pane__state--error"
      data-testid="detail-history-error"
      role="alert"
    >
      History could not be read.
      <button
        class="detail-activity__submit"
        type="button"
        data-testid="detail-history-retry"
        @click="emit('retry')"
      >
        Retry history
      </button>
    </p>

    <p
      v-else-if="events.length === 0"
      class="detail-pane__empty"
      data-testid="detail-history-empty"
      role="status"
    >
      No history recorded for this card yet.
    </p>

    <ol
      v-else
      class="detail-history__list"
      data-testid="detail-history-list"
    >
      <li
        v-for="event in events"
        :key="event.id"
        class="detail-history__item"
        data-testid="detail-history-event"
        :data-event-id="event.id"
        :data-event-verb="event.verb"
      >
        <p class="detail-activity__meta">
          <span class="detail-activity__author">{{ cardEventActorLabel(event) }}</span>
          <span>{{ cardEventVerbLabel(event.verb) }}</span>
          <time
            class="detail-activity__time"
            :datetime="event.createdAt"
          >{{ relativeTimestamp(event.createdAt, now) }}</time>
        </p>
        <ul
          v-if="cardEventFieldSummary(event).length > 0"
          class="detail-history__changes"
        >
          <li
            v-for="change in cardEventFieldSummary(event)"
            :key="change"
          >
            {{ change }}
          </li>
        </ul>
        <p
          v-for="related in cardEventRelated(event.payload)"
          :key="`${related.kind}-${related.id}`"
          class="detail-history__related"
        >
          <a
            class="detail-pane__reference"
            :href="`#${related.kind}-${related.id}`"
          >{{ related.kind === 'closure' ? 'Close record' : 'Handover' }}</a>
        </p>
      </li>
    </ol>

    <button
      v-if="hasEarlier"
      ref="loadEarlierButton"
      class="detail-activity__submit"
      type="button"
      data-testid="detail-history-load-earlier"
      :disabled="status === 'loading'"
      @click="loadEarlier"
    >
      {{ status === 'loading' ? 'Loading earlier history…' : 'Load earlier' }}
    </button>
  </section>
</template>
