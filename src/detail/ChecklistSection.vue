<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { computed, ref, useTemplateRef } from 'vue'
import type {
  ChecklistItem,
  ChecklistItemId,
  UpdateChecklistItemInput,
} from '@/domain/workplace'
import { checklistProgress } from '@/kanban/card-facets'

const props = defineProps<{
  items: readonly ChecklistItem[]
}>()

const emit = defineEmits<{
  create: [title: string]
  update: [checklistItemId: ChecklistItemId, input: UpdateChecklistItemInput]
  reorder: [checklistItemId: ChecklistItemId, position: number]
  remove: [checklistItemId: ChecklistItemId]
  removeAll: []
}>()

const addDraft = ref('')
const addInput = useTemplateRef<HTMLInputElement>('addInput')
const confirmDelete = ref(false)
const orderedItems = computed(() =>
  [...props.items].sort((left, right) => left.position - right.position),
)
const progress = computed(() => checklistProgress(orderedItems.value))
const percent = computed(() =>
  progress.value === null ? 0 : Math.round((progress.value.done / progress.value.total) * 100),
)

function focusAdd(): void {
  addInput.value?.focus()
}

defineExpose({ focusAdd })

function submitAdd(): void {
  const title = addDraft.value.trim()

  if (title === '') {
    return
  }

  emit('create', title)
  addDraft.value = ''
}

function onAddKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    submitAdd()
  }
}

function onTick(item: ChecklistItem, event: Event): void {
  const done = (event.target as HTMLInputElement).checked
  emit('update', item.id, { done })
}

function onTitleBlur(item: ChecklistItem, event: Event): void {
  const title = ((event.target as HTMLElement).textContent ?? '').trim()

  if (title === '' || title === item.title) {
    ;(event.target as HTMLElement).textContent = item.title
    return
  }

  emit('update', item.id, { title })
}

function onTitleKeydown(item: ChecklistItem, event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    ;(event.target as HTMLElement).blur()
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    ;(event.target as HTMLElement).textContent = item.title
    ;(event.target as HTMLElement).blur()
  }
}

function moveItem(item: ChecklistItem, direction: -1 | 1): void {
  const ordered = [...props.items].sort((left, right) => left.position - right.position)
  const current = ordered.findIndex((entry) => entry.id === item.id)
  const next = current + direction

  if (current < 0 || next < 0 || next >= ordered.length) {
    return
  }

  emit('reorder', item.id, next)
}

function onDragStart(item: ChecklistItem, event: DragEvent): void {
  event.dataTransfer?.setData('text/plain', item.id)

  if (event.dataTransfer !== null) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDrop(target: ChecklistItem, event: DragEvent): void {
  event.preventDefault()
  const draggedId = event.dataTransfer?.getData('text/plain')

  if (!draggedId || draggedId === target.id) {
    return
  }

  const ordered = [...props.items].sort((left, right) => left.position - right.position)
  const position = ordered.findIndex((entry) => entry.id === target.id)

  if (position >= 0) {
    emit('reorder', draggedId, position)
  }
}

function deleteAll(): void {
  confirmDelete.value = false
  emit('removeAll')
}
</script>

<template>
  <section
    class="detail-pane__section"
    data-testid="detail-checklist"
    aria-label="Checklist"
  >
    <div class="detail-checklist__header">
      <h3 class="detail-pane__section-title">
        Checklist
      </h3>
      <button
        v-if="orderedItems.length > 0 && !confirmDelete"
        class="detail-checklist__delete"
        type="button"
        @click="confirmDelete = true"
      >
        Delete
      </button>
      <p
        v-if="confirmDelete"
        class="detail-checklist__confirm"
      >
        Delete this checklist?
        <button
          class="detail-checklist__delete"
          type="button"
          @click="deleteAll"
        >
          Confirm delete
        </button>
        <button
          class="detail-checklist__cancel"
          type="button"
          @click="confirmDelete = false"
        >
          Cancel
        </button>
      </p>
    </div>

    <div
      v-if="progress !== null"
      class="detail-checklist__progress"
    >
      <span
        class="detail-checklist__percent"
        data-testid="detail-checklist-percent"
      >{{ percent }}%</span>
      <progress
        class="detail-checklist__bar"
        data-testid="detail-checklist-bar"
        :value="progress.done"
        :max="progress.total"
        :aria-label="`Checklist ${progress.done}/${progress.total}`"
      />
    </div>

    <ul
      v-if="orderedItems.length > 0"
      class="detail-checklist__items"
    >
      <li
        v-for="entry in orderedItems"
        :key="entry.id"
        class="detail-checklist__item"
        data-testid="detail-checklist-item"
        :data-checklist-id="entry.id"
        draggable="true"
        @dragstart="onDragStart(entry, $event)"
        @dragover.prevent
        @drop="onDrop(entry, $event)"
      >
        <input
          class="detail-checklist__tick"
          type="checkbox"
          :aria-label="entry.title"
          :checked="entry.done"
          @change="onTick(entry, $event)"
        >
        <span
          class="detail-checklist__title"
          contenteditable="true"
          spellcheck="false"
          role="textbox"
          :aria-label="`Checklist item ${entry.title}`"
          @blur="onTitleBlur(entry, $event)"
          @keydown="onTitleKeydown(entry, $event)"
        >{{ entry.title }}</span>
        <button
          class="detail-checklist__move"
          type="button"
          :aria-label="`Move ${entry.title} up`"
          :disabled="entry.position === 0"
          @click="moveItem(entry, -1)"
        >
          Up
        </button>
        <button
          class="detail-checklist__move"
          type="button"
          :aria-label="`Move ${entry.title} down`"
          :disabled="entry.position === orderedItems.length - 1"
          @click="moveItem(entry, 1)"
        >
          Down
        </button>
        <button
          class="detail-checklist__remove"
          type="button"
          :aria-label="`Delete ${entry.title}`"
          @click="emit('remove', entry.id)"
        >
          Delete item
        </button>
      </li>
    </ul>

    <p
      v-else
      class="detail-pane__empty"
      data-testid="detail-checklist-empty"
    >
      Add an item to start this checklist.
    </p>

    <div class="detail-checklist__add">
      <input
        ref="addInput"
        v-model="addDraft"
        class="detail-pane__search"
        type="text"
        aria-label="Add an item"
        placeholder="Add an item"
        @keydown="onAddKeydown"
      >
      <button
        class="detail-checklist__submit"
        type="button"
        @click="submitAdd"
      >
        Add
      </button>
    </div>
  </section>
</template>
