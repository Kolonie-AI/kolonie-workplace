<script setup lang="ts">
import { computed } from 'vue'
import { WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type { WorkItemDetail } from '@/domain/workplace'
import type { ItemDetailStatus } from '@/detail/use-item-detail'
import { renderHandover } from '@/detail/handover-parts'
import '@/detail/detail-pane.css'

/**
 * A small read surface over the fields that let a human resume work, beside a
 * board that stays visible. It is not a form: there is no edit control, no
 * comment box, no status control and no handover editor, because the first cut
 * has no write path at all. The one button closes it.
 *
 * The detail arrives as a prop from a composable that fetched it when the item
 * was opened; this component never reads a gateway and never falls back to the
 * board payload, so a field it cannot show is a field the Colony does not hold.
 */
const props = defineProps<{
  status: ItemDetailStatus
  item: WorkItemDetail | null
}>()

const emit = defineEmits<{
  close: []
}>()

const laneLabel = computed(() =>
  props.item === null ? null : WORKPLACE_LANE_LABELS[props.item.lane],
)
const handoverParts = computed(() =>
  props.item?.handover === undefined ? null : renderHandover(props.item.handover),
)
</script>

<template>
  <aside
    class="detail-pane"
    data-testid="detail-pane"
    aria-label="Work item detail"
  >
    <header class="detail-pane__header">
      <p class="detail-pane__eyebrow">
        Work item
      </p>
      <button
        class="detail-pane__close"
        type="button"
        data-testid="detail-close"
        aria-label="Close the work item detail"
        @click="emit('close')"
      >
        Close
      </button>
    </header>

    <p
      v-if="status === 'loading'"
      class="detail-pane__state"
      data-testid="detail-loading"
    >
      Loading this work item…
    </p>

    <p
      v-else-if="status === 'refused'"
      class="detail-pane__state detail-pane__state--error"
      data-testid="detail-refused"
      role="alert"
    >
      This work item is not available to you. It belongs to a board you may not
      open, so none of it is shown here.
    </p>

    <p
      v-else-if="status === 'error'"
      class="detail-pane__state detail-pane__state--error"
      data-testid="detail-error"
      role="alert"
    >
      This work item could not be read. This is a failure to read it, not a
      statement about what it holds.
    </p>

    <template v-else-if="item !== null">
      <h2
        class="detail-pane__title"
        data-testid="detail-title"
      >
        {{ item.title }}
      </h2>

      <dl class="detail-pane__facts">
        <div class="detail-pane__fact">
          <dt>Lane</dt>
          <dd data-testid="detail-lane">
            {{ laneLabel }}
          </dd>
        </div>
        <div class="detail-pane__fact">
          <dt>Owner</dt>
          <dd data-testid="detail-owner">
            {{ item.owner }}
          </dd>
        </div>
      </dl>

      <section
        v-if="item.blocker !== undefined"
        class="detail-pane__section detail-pane__section--blocked"
        data-testid="detail-blocker"
        aria-label="Blocker"
      >
        <h3 class="detail-pane__section-title">
          Blocker
        </h3>
        <dl class="detail-pane__facts">
          <div class="detail-pane__fact">
            <dt>Waiting on</dt>
            <dd data-testid="detail-blocker-actor">
              {{ item.blocker.actor }}
            </dd>
          </div>
          <div class="detail-pane__fact">
            <dt>Smallest unblock</dt>
            <dd data-testid="detail-blocker-unblock">
              {{ item.blocker.smallestUnblock }}
            </dd>
          </div>
        </dl>
      </section>

      <section
        class="detail-pane__section"
        aria-label="Handover"
      >
        <h3 class="detail-pane__section-title">
          Handover
        </h3>

        <p
          v-if="handoverParts === null"
          class="detail-pane__empty"
          data-testid="detail-handover-absent"
        >
          No handover recorded for this work item yet. Nothing has been written
          here, which is not the same as nothing having happened.
        </p>

        <dl
          v-else
          class="detail-pane__handover"
          data-testid="detail-handover"
        >
          <div
            v-for="entry in handoverParts"
            :key="entry.part"
            class="detail-pane__fact"
            :data-testid="`detail-handover-${entry.part}`"
          >
            <dt>{{ entry.label }}</dt>
            <dd>
              <span v-if="entry.text !== null">{{ entry.text }}</span>
              <a
                v-for="link in entry.links"
                :key="link.href"
                class="detail-pane__reference"
                data-testid="detail-evidence"
                :href="link.href"
                rel="noreferrer"
              >{{ link.label }}</a>
            </dd>
          </div>
        </dl>
      </section>

      <section
        v-if="item.externalReferences.length > 0"
        class="detail-pane__section"
        aria-label="References"
      >
        <h3 class="detail-pane__section-title">
          References
        </h3>
        <ul class="detail-pane__references">
          <li
            v-for="reference in item.externalReferences"
            :key="reference.href"
          >
            <a
              class="detail-pane__reference"
              data-testid="detail-reference"
              :href="reference.href"
              rel="noreferrer"
            >{{ reference.label }}</a>
          </li>
        </ul>
      </section>
    </template>
  </aside>
</template>
