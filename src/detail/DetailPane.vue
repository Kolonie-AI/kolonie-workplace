<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { computed, nextTick, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import { WORKPLACE_LANE_LABELS } from '@/domain/lanes'
import type {
  AttachmentId,
  ChecklistItemId,
  CommentId,
  CreateAttachmentInput,
  UpdateChecklistItemInput,
  UpdateWorkItemInput,
  WorkItemAssignee,
  WorkItemDetail,
  WorkItemLabel,
} from '@/domain/workplace'
import type { ItemDetailStatus } from '@/detail/use-item-detail'
import ActivitySection from '@/detail/ActivitySection.vue'
import AttachmentSection from '@/detail/AttachmentSection.vue'
import ChecklistSection from '@/detail/ChecklistSection.vue'
import { renderHandover } from '@/detail/handover-parts'
import { sanitizeDescription } from '@/detail/sanitize-description'
import {
  dueDateState,
  isWorkItemPriority,
  readableTextOn,
  relativeDueDate,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_PRIORITY_LABELS,
} from '@/kanban/card-facets'
import '@/detail/detail-pane.css'

const props = defineProps<{
  status: ItemDetailStatus
  item: WorkItemDetail | null
  updateError: string | null
  availableLabels: readonly WorkItemLabel[]
  availableAssignees: readonly WorkItemAssignee[]
  now: Date
  currentHumanName: string | null
  showsPreviewData: boolean
}>()

const emit = defineEmits<{
  close: []
  update: [input: UpdateWorkItemInput]
  createChecklistItem: [title: string]
  updateChecklistItem: [checklistItemId: ChecklistItemId, input: UpdateChecklistItemInput]
  reorderChecklistItem: [checklistItemId: ChecklistItemId, position: number]
  deleteChecklistItem: [checklistItemId: ChecklistItemId]
  deleteChecklist: []
  createComment: [body: string]
  updateComment: [commentId: CommentId, body: string]
  deleteComment: [commentId: CommentId]
  addAttachment: [input: CreateAttachmentInput]
  deleteAttachment: [attachmentId: AttachmentId]
}>()

type RailPopover = 'labels' | 'members' | 'dates' | 'priority' | 'cover' | null

const titleDraft = ref('')
const descriptionDraft = ref('')
const descriptionEditor = useTemplateRef<HTMLElement>('descriptionEditor')
const dialogEl = useTemplateRef<HTMLElement>('dialogEl')
const checklistSection = useTemplateRef<{ focusAdd: () => void }>('checklistSection')
const attachmentSection = useTemplateRef<{ openPicker: () => void }>('attachmentSection')
const coverColours = ['#1973ff', '#00db60', '#ff4136', '#8338ec'] as const
const railPopover = ref<RailPopover>(null)
const labelQuery = ref('')
const assigneeQuery = ref('')
const labelActive = ref(-1)
const assigneeActive = ref(-1)
const labelOpen = ref(false)
const assigneeOpen = ref(false)
const labelListId = `label-options-${useId()}`
const assigneeListId = `assignee-options-${useId()}`
const labelColours = ['#1973ff', '#00db60', '#ff4136', '#8338ec'] as const
const selectedLabelColour = ref<(typeof labelColours)[number]>(labelColours[0])

const filteredLabels = computed(() => {
  const selected = new Set(props.item?.labels.map((label) => label.id) ?? [])
  const query = labelQuery.value.trim().toLocaleLowerCase()

  return props.availableLabels.filter(
    (label) => !selected.has(label.id) && label.title.toLocaleLowerCase().includes(query),
  )
})

const filteredAssignees = computed(() => {
  const selected = new Set(props.item?.assignees.map((assignee) => assignee.id) ?? [])
  const query = assigneeQuery.value.trim().toLocaleLowerCase()

  return props.availableAssignees.filter(
    (assignee) => !selected.has(assignee.id) && assignee.name.toLocaleLowerCase().includes(query),
  )
})

const canCreateLabel = computed(() => {
  const query = labelQuery.value.trim().toLocaleLowerCase()

  return query !== '' && ![...props.availableLabels, ...(props.item?.labels ?? [])].some(
    (label) => label.title.toLocaleLowerCase() === query,
  )
})

const activeLabelId = computed(() =>
  labelActive.value < 0 ? undefined : `${labelListId}-${labelActive.value}`,
)
const activeAssigneeId = computed(() =>
  assigneeActive.value < 0 ? undefined : `${assigneeListId}-${assigneeActive.value}`,
)

const laneLabel = computed(() =>
  props.item === null ? null : WORKPLACE_LANE_LABELS[props.item.lane],
)
const dueState = computed(() =>
  props.item === null ? null : dueDateState(props.item.dueDate, props.now),
)
const dueRelative = computed(() =>
  props.item === null ? null : relativeDueDate(props.item.dueDate, props.now),
)
const handoverParts = computed(() =>
  props.item?.handover === undefined ? null : renderHandover(props.item.handover),
)
const dialogName = computed(() => props.item?.title ?? 'Work item detail')
const coverKind = computed<'image' | 'colour' | null>(() => {
  if (props.item?.coverImageUrl) {
    return 'image'
  }

  if (props.item?.coverColour) {
    return 'colour'
  }

  return null
})

onMounted(async () => {
  await nextTick()
  dialogEl.value?.focus()
})

function closeDialog(): void {
  emit('close')
}

function toggleRail(kind: Exclude<RailPopover, null>): void {
  const next = railPopover.value === kind ? null : kind
  railPopover.value = next
  labelOpen.value = next === 'labels'
  assigneeOpen.value = next === 'members'
}

function onDialogKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.isComposing) {
    return
  }

  if (railPopover.value !== null) {
    event.preventDefault()
    event.stopPropagation()
    railPopover.value = null
    labelOpen.value = false
    assigneeOpen.value = false
    return
  }

  event.preventDefault()
  closeDialog()
}

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

watch(
  () => props.updateError,
  async (error) => {
    if (error === null || props.item === null) {
      return
    }

    titleDraft.value = props.item.title
    descriptionDraft.value = sanitizeDescription(props.item.description)
    await nextTick()

    if (descriptionEditor.value !== null) {
      descriptionEditor.value.innerHTML = descriptionDraft.value
    }
  },
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
    event.stopPropagation()
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

function labelStyle(colour: string): { background: string; color: string } {
  return { background: colour, color: readableTextOn(colour) }
}

function updateLabels(labels: readonly WorkItemLabel[]): void {
  emit('update', { labels })
  labelQuery.value = ''
  labelActive.value = -1
  labelOpen.value = false
}

function updateAssignees(assignees: readonly WorkItemAssignee[]): void {
  emit('update', { assignees })
  assigneeQuery.value = ''
  assigneeActive.value = -1
  assigneeOpen.value = false
}

function addLabel(label: WorkItemLabel): void {
  updateLabels([...(props.item?.labels ?? []), label])
}

function createLabel(): void {
  const title = labelQuery.value.trim()

  if (title === '' || !canCreateLabel.value) {
    return
  }

  addLabel({
    id: `created-label-${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    colour: selectedLabelColour.value,
  })
}

function removeLabel(label: WorkItemLabel): void {
  updateLabels((props.item?.labels ?? []).filter((candidate) => candidate.id !== label.id))
}

function addAssignee(assignee: WorkItemAssignee): void {
  updateAssignees([...(props.item?.assignees ?? []), assignee])
}

function removeAssignee(assignee: WorkItemAssignee): void {
  updateAssignees(
    (props.item?.assignees ?? []).filter((candidate) => candidate.id !== assignee.id),
  )
}

function onLabelKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    labelOpen.value = true
    labelActive.value = Math.min(labelActive.value + 1, filteredLabels.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    labelActive.value = Math.max(labelActive.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const label = filteredLabels.value[labelActive.value]
    if (label !== undefined) addLabel(label)
    else createLabel()
  } else if (event.key === 'Backspace' && labelQuery.value === '') {
    const last = props.item?.labels.at(-1)
    if (last !== undefined) removeLabel(last)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    labelOpen.value = false
    labelActive.value = -1
    railPopover.value = null
  }
}

function onPriorityChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value

  if (isWorkItemPriority(value) && value !== props.item?.priority) {
    emit('update', { priority: value })
  }
}

function onDueDateChange(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  const dueDate = value === '' ? null : value

  if (dueDate !== props.item?.dueDate) {
    emit('update', { dueDate })
  }
}

function onPercentDoneChange(event: Event): void {
  const percentDone = Number((event.target as HTMLInputElement).value)

  if (!Number.isFinite(percentDone) || percentDone === props.item?.percentDone) {
    return
  }

  emit('update', { percentDone: Math.min(100, Math.max(0, Math.round(percentDone))) })
}

function setColourCover(colour: string): void {
  if (colour === props.item?.coverColour) {
    return
  }

  emit('update', {
    coverColour: colour,
    coverAttachmentId: null,
    coverImageUrl: null,
  })
}

function setImageCover(attachmentId: AttachmentId, imageUrl: string): void {
  emit('update', {
    coverAttachmentId: attachmentId,
    coverColour: null,
    coverImageUrl: imageUrl,
  })
}

function removeCover(): void {
  emit('update', {
    coverAttachmentId: null,
    coverColour: null,
    coverImageUrl: null,
  })
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const files = event.dataTransfer?.files

  if (files === undefined || files.length === 0) {
    return
  }

  for (const file of files) {
    emit('addAttachment', {
      name: file.name,
      size: file.size,
      mimeType: file.type === '' ? 'application/octet-stream' : file.type,
      file,
    })
  }
}

function onAssigneeKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    assigneeOpen.value = true
    assigneeActive.value = Math.min(assigneeActive.value + 1, filteredAssignees.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    assigneeActive.value = Math.max(assigneeActive.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const assignee = filteredAssignees.value[assigneeActive.value]
    if (assignee !== undefined) addAssignee(assignee)
  } else if (event.key === 'Backspace' && assigneeQuery.value === '') {
    const last = props.item?.assignees.at(-1)
    if (last !== undefined) removeAssignee(last)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    assigneeOpen.value = false
    assigneeActive.value = -1
    railPopover.value = null
  }
}
</script>

<template>
  <div class="detail-layer">
    <button
      class="detail-overlay"
      type="button"
      data-testid="detail-overlay"
      aria-label="Close the work item"
      @click="closeDialog"
    />
    <div
      ref="dialogEl"
      class="detail-pane"
      data-testid="detail-pane"
      role="dialog"
      aria-modal="true"
      :aria-label="dialogName"
      tabindex="-1"
      @keydown="onDialogKeydown"
      @dragover.prevent
      @drop="onDrop"
    >
      <header class="detail-pane__header">
        <p
          class="detail-pane__lane"
          data-testid="detail-lane"
        >
          in list {{ laneLabel }}
        </p>
        <button
          class="detail-pane__close"
          type="button"
          data-testid="detail-close"
          aria-label="Close the work item"
          @click="closeDialog"
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

        <span
          v-if="coverKind !== null"
          class="detail-pane__cover"
          data-testid="detail-cover"
          :data-cover-kind="coverKind"
          :style="coverKind === 'colour' ? { background: item.coverColour ?? undefined } : undefined"
        >
          <img
            v-if="coverKind === 'image' && item.coverImageUrl !== null"
            class="detail-pane__cover-image"
            :src="item.coverImageUrl"
            alt=""
          >
        </span>
        <button
          v-if="coverKind !== null"
          class="detail-pane__remove-cover"
          type="button"
          @click="removeCover"
        >
          Remove cover
        </button>

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

        <div class="detail-pane__layout">
          <div class="detail-pane__main">
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

            <ChecklistSection
              ref="checklistSection"
              :items="item.checklist"
              @create="emit('createChecklistItem', $event)"
              @update="(id, input) => emit('updateChecklistItem', id, input)"
              @reorder="(id, position) => emit('reorderChecklistItem', id, position)"
              @remove="emit('deleteChecklistItem', $event)"
              @remove-all="emit('deleteChecklist')"
            />

            <AttachmentSection
              ref="attachmentSection"
              :attachments="item.attachments"
              :cover-attachment-id="item.coverAttachmentId"
              :shows-preview-data="showsPreviewData"
              @add="emit('addAttachment', $event)"
              @remove="emit('deleteAttachment', $event)"
              @set-cover="setImageCover"
            />

            <ActivitySection
              :comments="item.comments"
              :current-human-name="currentHumanName"
              :now="now"
              @create="emit('createComment', $event)"
              @update="(id, body) => emit('updateComment', id, body)"
              @remove="emit('deleteComment', $event)"
            />

            <dl class="detail-pane__facts">
              <div class="detail-pane__fact">
                <dt>Owner</dt>
                <dd data-testid="detail-owner">
                  {{ item.owner }}
                </dd>
              </div>
              <div class="detail-pane__fact">
                <dt>Labels</dt>
                <dd data-testid="detail-labels">
                  <div class="detail-pane__chips">
                    <span
                      v-for="label in item.labels"
                      :key="label.id"
                      class="detail-pane__chip"
                      :style="labelStyle(label.colour)"
                    >
                      {{ label.title }}
                      <button
                        class="detail-pane__chip-remove"
                        type="button"
                        :aria-label="`Remove label ${label.title}`"
                        @click="removeLabel(label)"
                      >×</button>
                    </span>
                  </div>
                </dd>
              </div>
              <div class="detail-pane__fact">
                <dt>Assignees</dt>
                <dd data-testid="detail-assignees">
                  <div class="detail-pane__chips">
                    <span
                      v-for="assignee in item.assignees"
                      :key="assignee.id"
                      class="detail-pane__chip detail-pane__chip--plain"
                    >
                      {{ assignee.name }}
                      <button
                        class="detail-pane__chip-remove"
                        type="button"
                        :aria-label="`Remove assignee ${assignee.name}`"
                        @click="removeAssignee(assignee)"
                      >×</button>
                    </span>
                  </div>
                </dd>
              </div>
              <div class="detail-pane__fact">
                <dt>Due date</dt>
                <dd
                  data-testid="detail-due-date"
                  :data-due-state="dueState ?? undefined"
                >
                  <p
                    v-if="dueRelative !== null"
                    class="detail-pane__due-relative"
                    data-testid="detail-due-relative"
                  >
                    {{ dueRelative }}
                  </p>
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
          </div>

          <aside
            class="detail-pane__rail"
            aria-label="Add to card"
          >
            <button
              class="detail-pane__rail-button"
              type="button"
              @click="checklistSection?.focusAdd()"
            >
              Checklist
            </button>
            <button
              class="detail-pane__rail-button"
              type="button"
              @click="attachmentSection?.openPicker()"
            >
              Attachment
            </button>
            <button
              class="detail-pane__rail-button"
              type="button"
              :aria-expanded="railPopover === 'cover' ? 'true' : 'false'"
              @click="toggleRail('cover')"
            >
              Cover
            </button>
            <div
              v-if="railPopover === 'cover'"
              class="detail-pane__popover"
              role="dialog"
              aria-label="Cover"
            >
              <div
                class="detail-pane__palette"
                aria-label="Cover colours"
              >
                <button
                  v-for="(colour, index) in coverColours"
                  :key="colour"
                  class="detail-pane__swatch"
                  :class="{ 'detail-pane__swatch--selected': colour === item.coverColour }"
                  type="button"
                  :aria-label="`Choose cover colour ${index + 1}`"
                  :aria-pressed="colour === item.coverColour"
                  :style="{ background: colour }"
                  @click="setColourCover(colour)"
                />
              </div>
              <button
                v-if="coverKind !== null"
                class="detail-pane__rail-button"
                type="button"
                @click="removeCover"
              >
                Remove cover
              </button>
            </div>
            <button
              class="detail-pane__rail-button"
              type="button"
              :aria-expanded="railPopover === 'labels' ? 'true' : 'false'"
              @click="toggleRail('labels')"
            >
              Labels
            </button>
            <div
              v-if="railPopover === 'labels'"
              class="detail-pane__popover"
              role="dialog"
              aria-label="Labels"
            >
              <div class="detail-pane__multiselect">
                <input
                  v-model="labelQuery"
                  class="detail-pane__search"
                  type="text"
                  role="combobox"
                  aria-label="Search labels"
                  aria-autocomplete="list"
                  :aria-expanded="labelOpen && (filteredLabels.length > 0 || canCreateLabel)"
                  :aria-controls="labelListId"
                  :aria-activedescendant="activeLabelId"
                  @focus="labelOpen = true"
                  @input="labelOpen = true; labelActive = -1"
                  @keydown="onLabelKeydown"
                >
                <div
                  class="detail-pane__palette"
                  aria-label="Label colours"
                >
                  <button
                    v-for="(colour, index) in labelColours"
                    :key="colour"
                    class="detail-pane__swatch"
                    :class="{ 'detail-pane__swatch--selected': colour === selectedLabelColour }"
                    type="button"
                    :aria-label="`Choose label colour ${index + 1}`"
                    :aria-pressed="colour === selectedLabelColour"
                    :style="{ background: colour }"
                    @click="selectedLabelColour = colour"
                  />
                </div>
                <ul
                  v-if="labelOpen && (filteredLabels.length > 0 || canCreateLabel)"
                  :id="labelListId"
                  class="detail-pane__options"
                  role="listbox"
                  aria-label="Label suggestions"
                >
                  <li
                    v-for="(label, index) in filteredLabels"
                    :id="`${labelListId}-${index}`"
                    :key="label.id"
                    class="detail-pane__option"
                    :class="{ 'detail-pane__option--active': index === labelActive }"
                    role="option"
                    :aria-selected="index === labelActive"
                    :aria-label="label.title"
                    @click="addLabel(label)"
                  >
                    {{ label.title }}
                  </li>
                  <li
                    v-if="canCreateLabel"
                    class="detail-pane__option"
                    role="option"
                    :aria-label="`Create label ${labelQuery.trim()}`"
                    aria-selected="false"
                    @click="createLabel"
                  >
                    Create “{{ labelQuery.trim() }}”
                  </li>
                </ul>
              </div>
            </div>

            <button
              class="detail-pane__rail-button"
              type="button"
              :aria-expanded="railPopover === 'members' ? 'true' : 'false'"
              @click="toggleRail('members')"
            >
              Members
            </button>
            <div
              v-if="railPopover === 'members'"
              class="detail-pane__popover"
              role="dialog"
              aria-label="Members"
            >
              <div class="detail-pane__multiselect">
                <input
                  v-model="assigneeQuery"
                  class="detail-pane__search"
                  type="text"
                  role="combobox"
                  aria-label="Search assignees"
                  aria-autocomplete="list"
                  :aria-expanded="assigneeOpen && filteredAssignees.length > 0"
                  :aria-controls="assigneeListId"
                  :aria-activedescendant="activeAssigneeId"
                  @focus="assigneeOpen = true"
                  @input="assigneeOpen = true; assigneeActive = -1"
                  @keydown="onAssigneeKeydown"
                >
                <ul
                  v-if="assigneeOpen && filteredAssignees.length > 0"
                  :id="assigneeListId"
                  class="detail-pane__options"
                  role="listbox"
                  aria-label="Assignee suggestions"
                >
                  <li
                    v-for="(assignee, index) in filteredAssignees"
                    :id="`${assigneeListId}-${index}`"
                    :key="assignee.id"
                    class="detail-pane__option"
                    :class="{ 'detail-pane__option--active': index === assigneeActive }"
                    role="option"
                    :aria-selected="index === assigneeActive"
                    :aria-label="assignee.name"
                    @click="addAssignee(assignee)"
                  >
                    {{ assignee.name }}
                  </li>
                </ul>
              </div>
            </div>

            <button
              class="detail-pane__rail-button"
              type="button"
              :aria-expanded="railPopover === 'dates' ? 'true' : 'false'"
              @click="toggleRail('dates')"
            >
              Dates
            </button>
            <div
              v-if="railPopover === 'dates'"
              class="detail-pane__popover"
              role="dialog"
              aria-label="Dates"
            >
              <label class="detail-pane__move-label">
                Due date
                <input
                  class="detail-pane__control"
                  type="date"
                  aria-label="Due date"
                  :value="item.dueDate ?? ''"
                  @input="onDueDateChange"
                >
              </label>
            </div>

            <button
              class="detail-pane__rail-button"
              type="button"
              :aria-expanded="railPopover === 'priority' ? 'true' : 'false'"
              @click="toggleRail('priority')"
            >
              Priority
            </button>
            <div
              v-if="railPopover === 'priority'"
              class="detail-pane__popover"
              role="dialog"
              aria-label="Priority"
              data-testid="detail-priority"
            >
              <select
                class="detail-pane__control"
                :class="`detail-pane__priority--${item.priority}`"
                aria-label="Priority"
                :value="item.priority"
                @change="onPriorityChange"
              >
                <option
                  v-for="priority in WORK_ITEM_PRIORITIES"
                  :key="priority"
                  :value="priority"
                >
                  {{ WORK_ITEM_PRIORITY_LABELS[priority] }}
                </option>
              </select>
              <label class="detail-pane__progress-label">
                Percent done
                <input
                  class="detail-pane__progress"
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  aria-label="Percent done"
                  :value="item.percentDone"
                  @input="onPercentDoneChange"
                >
                <span class="detail-pane__progress-value">{{ item.percentDone }}%</span>
              </label>
            </div>
          </aside>
        </div>
      </template>
    </div>
  </div>
</template>
