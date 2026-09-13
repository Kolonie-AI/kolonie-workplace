<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { computed } from 'vue'
import type { CardClosure, CardLink } from '@/domain/workplace'
import type { DetailReadStatus } from '@/detail/use-item-detail'
import { CARD_CLOSURE_RESULT_LABELS, evidenceHref } from '@/detail/card-history'
import { WORKPLACE_LINK_KIND_LABELS } from '@/domain/workplace'

const props = defineProps<{
  status: DetailReadStatus
  closures: readonly CardClosure[]
}>()

const emit = defineEmits<{
  retry: []
  copyEvidence: [ref: string]
}>()

function copyEvidence(ref: string): void {
  emit('copyEvidence', ref)
}

const latest = computed(() => props.closures[0] ?? null)
const previous = computed(() => props.closures.slice(1))

function evidenceLabel(link: CardLink): string {
  return link.summary.length > 0 ? link.summary : link.ref
}

function nextLabel(closure: CardClosure): string {
  if (closure.next.kind === 'none') {
    return 'None'
  }
  if (closure.next.kind === 'card') {
    return `Card ${closure.next.cardId}`
  }
  return closure.next.text
}
</script>

<template>
  <section
    class="detail-pane__section"
    data-testid="detail-outcome"
    aria-label="Outcome"
  >
    <h3 class="detail-pane__section-title">
      Outcome
    </h3>

    <p
      v-if="status === 'loading' && closures.length === 0"
      class="detail-pane__empty"
      data-testid="detail-outcome-loading"
      role="status"
    >
      Loading outcome…
    </p>

    <p
      v-else-if="status === 'error'"
      class="detail-pane__state detail-pane__state--error"
      data-testid="detail-outcome-error"
      role="alert"
    >
      Outcome could not be read.
      <button
        class="detail-activity__submit"
        type="button"
        data-testid="detail-outcome-retry"
        @click="emit('retry')"
      >
        Retry outcome
      </button>
    </p>

    <p
      v-else-if="latest === null"
      class="detail-pane__empty"
      data-testid="detail-outcome-empty"
      role="status"
    >
      No close record yet.
    </p>

    <article
      v-else
      :id="`closure-${latest.id}`"
      class="detail-outcome__latest"
      data-testid="detail-outcome-latest"
    >
      <p
        class="detail-outcome__result"
        data-testid="detail-outcome-result"
        :data-result="latest.result"
      >
        {{ CARD_CLOSURE_RESULT_LABELS[latest.result] }}
        <span
          v-if="latest.legacy"
          class="detail-outcome__legacy"
        >Ungrounded legacy close</span>
      </p>
      <dl class="detail-pane__facts">
        <div class="detail-pane__fact">
          <dt>Summary</dt>
          <dd data-testid="detail-outcome-summary">
            {{ latest.summary }}
          </dd>
        </div>
        <div class="detail-pane__fact">
          <dt>Learned</dt>
          <dd data-testid="detail-outcome-learned">
            {{ latest.learned }}
          </dd>
        </div>
        <div class="detail-pane__fact">
          <dt>Evidence</dt>
          <dd>
            <ul
              v-if="latest.evidenceLinks.length > 0"
              class="detail-pane__references"
            >
              <li
                v-for="link in latest.evidenceLinks"
                :key="link.id"
                data-testid="detail-outcome-evidence"
              >
                <a
                  v-if="evidenceHref(link.ref) !== null"
                  class="detail-pane__reference"
                  :href="evidenceHref(link.ref) ?? undefined"
                  rel="noreferrer"
                  target="_blank"
                >{{ evidenceLabel(link) }}</a>
                <button
                  v-else
                  class="detail-outcome__copy"
                  type="button"
                  :aria-label="`Copy ${WORKPLACE_LINK_KIND_LABELS[link.kind]} evidence ${evidenceLabel(link)}`"
                  :data-copy-ref="link.ref"
                  @click="copyEvidence(link.ref)"
                >
                  {{ evidenceLabel(link) }}
                </button>
              </li>
            </ul>
            <span v-else>None</span>
          </dd>
        </div>
        <div class="detail-pane__fact">
          <dt>Next</dt>
          <dd data-testid="detail-outcome-next">
            {{ nextLabel(latest) }}
          </dd>
        </div>
      </dl>
    </article>

    <details
      v-if="previous.length > 0"
      class="detail-outcome__previous"
      data-testid="detail-outcome-previous"
    >
      <summary>Previous outcome revisions</summary>
      <ol class="detail-history__list">
        <li
          v-for="closure in previous"
          :id="`closure-${closure.id}`"
          :key="closure.id"
          data-testid="detail-outcome-revision"
        >
          <p class="detail-outcome__result">
            Revision {{ closure.revision }} · {{ CARD_CLOSURE_RESULT_LABELS[closure.result] }}
          </p>
          <p>{{ closure.summary }}</p>
        </li>
      </ol>
    </details>
  </section>
</template>
