<script setup lang="ts">
/*
 * Copyright 2018-present Vikunja and contributors. All rights reserved.
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The editable heading, description surface and metadata layout are adapted
 * for Kolonie Workplace on 2026-08-27 from Vikunja 2.5.0
 * (ef2200e9429c5cc42f5c1811433418bfcc72b3aa):
 *   frontend/src/views/tasks/TaskDetailView.vue
 *   frontend/src/components/tasks/partials/Heading.vue
 *   frontend/src/components/tasks/partials/Description.vue
 * No Vikunja store, router, i18n or task model is used.
 */
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type { UpdateWorkItemInput, WorkItemDetail } from '@/domain/workplace'
import type { ItemDetailStatus } from '@/detail/use-item-detail'
import { renderHandover } from '@/detail/handover-parts'
import { sanitizeDescription } from '@/detail/sanitize-description'
import { WORK_ITEM_PRIORITY_LABELS } from '@/kanban/card-facets'
import '@/detail/detail-pane.css'

const props = defineProps<{
  status: ItemDetailStatus
  item: WorkItemDetail | null
  updateError: string | null
}>()

const emit = defineEmits<{
  close: []
  update: [input: UpdateWorkItemInput]
}>()

const titleDraft = ref('')
const descriptionDraft = ref('')
const descriptionEditor = useTemplateRef<HTMLElement>('descriptionEditor')

const laneLabel = computed(() =>
  props.item === null ? null : WORKPLACE_LANE_LABELS[props.item.lane],
)
const priorityLabel = computed(() =>
  props.item === null ? null : WORK_ITEM_PRIORITY_LABELS[props.item.priority],
)
const handoverParts = computed(() =>
  props.item?.handover === undefined ? null : renderHandover(props.item.handover),
)

watch(
  () => props.item,
  async (item) => {
    titleDraft.value = item?.title ?? ''
    descriptionDraft.value = sanitizeDescription(item?.description ?? '')
    await nextTick()

    if (descriptionEditor.value !== null) {
      descriptionEditor.value.innerHTML = descriptionDraft.value
    }
  },
  { immediate: true },
)

function onTitleInput(event: Event): void {
  titleDraft.value = (event.target as HTMLElement).textContent ?? ''
}

function saveTitle(): void {
  const previous = props.item?.title
  const title = titleDraft.value.trim()

  if (previous === undefined) {
    return
  }

  if (title === '') {
    titleDraft.value = previous
    return
  }

  if (title !== previous) {
    emit('update', { title })
  }
}

function onTitleKeydown(event: KeyboardEvent): void {
  if (event.isComposing) {
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    saveTitle()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    const element = event.target as HTMLElement
    titleDraft.value = props.item?.title ?? ''
    element.textContent = titleDraft.value
    element.blur()
  }
}

function onDescriptionInput(event: Event): void {
  descriptionDraft.value = (event.target as HTMLElement).innerHTML
}

function saveDescription(): void {
  const previous = props.item?.description

  if (previous === undefined) {
    return
  }

  const sanitized = sanitizeDescription(descriptionDraft.value)
  descriptionDraft.value = sanitized

  if (descriptionEditor.value !== null) {
    descriptionEditor.value.innerHTML = sanitized
  }

  if (sanitized !== previous) {
    emit('update', { description: sanitized })
  }
}

function formatDescription(command: string, value?: string): void {
  descriptionEditor.value?.focus()
  document.execCommand(command, false, value)

  if (descriptionEditor.value !== null) {
    descriptionDraft.value = descriptionEditor.value.innerHTML
  }
}

function addLink(): void {
  const href = window.prompt('Link address')

  if (href !== null && /^(https?:|mailto:|\/|#)/i.test(href)) {
    formatDescription('createLink', href)
  }
}
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
      <p
        v-if="updateError !== null"
        class="detail-pane__state detail-pane__state--error"
        data-testid="detail-update-error"
        role="alert"
      >
        {{ updateError }}
      </p>

      <h2
        class="detail-pane__title"
        data-testid="detail-title"
        contenteditable="true"
        spellcheck="false"
        role="textbox"
        aria-label="Work item title"
        @input="onTitleInput"
        @blur="saveTitle"
        @keydown="onTitleKeydown"
      >
        {{ titleDraft }}
      </h2>

      <section
        class="detail-pane__section"
        aria-label="Description"
      >
        <h3 class="detail-pane__section-title">
          Description
        </h3>
        <div
          class="detail-pane__toolbar"
          role="toolbar"
          aria-label="Description formatting"
        >
          <button
            class="detail-pane__format"
            type="button"
            aria-label="Bold"
            @mousedown.prevent="formatDescription('bold')"
          >
            Bold
          </button>
          <button
            class="detail-pane__format"
            type="button"
            aria-label="Italic"
            @mousedown.prevent="formatDescription('italic')"
          >
            Italic
          </button>
          <button
            class="detail-pane__format"
            type="button"
            aria-label="Bulleted list"
            @mousedown.prevent="formatDescription('insertUnorderedList')"
          >
            List
          </button>
          <button
            class="detail-pane__format"
            type="button"
            aria-label="Numbered list"
            @mousedown.prevent="formatDescription('insertOrderedList')"
          >
            Numbered
          </button>
          <button
            class="detail-pane__format"
            type="button"
            aria-label="Link"
            @mousedown.prevent="addLink"
          >
            Link
          </button>
          <button
            class="detail-pane__format"
            type="button"
            aria-label="Code"
            @mousedown.prevent="formatDescription('formatBlock', 'pre')"
          >
            Code
          </button>
        </div>
        <div
          ref="descriptionEditor"
          class="detail-pane__description"
          data-testid="detail-description"
          contenteditable="true"
          role="textbox"
          aria-label="Work item description"
          aria-multiline="true"
          @input="onDescriptionInput"
          @blur="saveDescription"
        />
      </section>

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
        <div class="detail-pane__fact">
          <dt>Priority</dt>
          <dd data-testid="detail-priority">
            {{ priorityLabel }}
          </dd>
        </div>
        <div class="detail-pane__fact">
          <dt>Due date</dt>
          <dd data-testid="detail-due-date">
            {{ item.dueDate ?? 'None' }}
          </dd>
        </div>
        <div class="detail-pane__fact">
          <dt>Labels</dt>
          <dd data-testid="detail-labels">
            {{ item.labels.map((label) => label.title).join(', ') || 'None' }}
          </dd>
        </div>
        <div class="detail-pane__fact">
          <dt>Assignees</dt>
          <dd data-testid="detail-assignees">
            {{ item.assignees.map((assignee) => assignee.name).join(', ') || 'None' }}
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
