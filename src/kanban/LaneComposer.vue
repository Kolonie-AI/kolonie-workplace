<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Creating a card reaches the gateway only through the board's createItem
 * call.
 */
import { nextTick, ref, useTemplateRef } from 'vue'
import { WORKPLACE_LANE_LABELS, type Lane } from '@/domain/lanes'

const props = defineProps<{
  lane: Lane
}>()

const emit = defineEmits<{
  create: [title: string, lane: Lane]
}>()

const open = ref(false)
const title = ref('')
const input = useTemplateRef<HTMLTextAreaElement>('composerInput')
const addButton = useTemplateRef<HTMLButtonElement>('addButton')
const root = useTemplateRef<HTMLElement>('composerRoot')

const laneLabel = WORKPLACE_LANE_LABELS[props.lane]

async function openComposer(): Promise<void> {
  open.value = true
  await nextTick()
  input.value?.focus()
}

function closeComposer(): void {
  open.value = false
  title.value = ''
  void nextTick(() => {
    addButton.value?.focus()
  })
}

function submit(): void {
  const trimmed = title.value.trim()

  if (trimmed === '') {
    return
  }

  emit('create', trimmed, props.lane)
  title.value = ''
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeComposer()
  }
}

function onBlur(event: FocusEvent): void {
  const next = event.relatedTarget

  if (next instanceof Node && root.value?.contains(next)) {
    return
  }

  if (title.value.trim() === '') {
    closeComposer()
  }
}
</script>

<template>
  <div
    ref="composerRoot"
    class="lane-composer"
    data-testid="lane-composer"
  >
    <button
      v-if="!open"
      ref="addButton"
      class="lane-composer__add"
      type="button"
      :aria-label="`Add a card in ${laneLabel}`"
      @click="openComposer"
    >
      Add a card
    </button>
    <form
      v-else
      class="lane-composer__form"
      @submit.prevent="submit"
    >
      <textarea
        ref="composerInput"
        v-model="title"
        class="lane-composer__input"
        rows="3"
        aria-label="Enter a title or paste a link"
        placeholder="Enter a title or paste a link"
        @keydown="onKeydown"
        @blur="onBlur"
      />
      <div class="lane-composer__actions">
        <button
          class="lane-composer__submit"
          type="submit"
        >
          Add card
        </button>
        <button
          class="lane-composer__cancel"
          type="button"
          aria-label="Cancel adding a card"
          @click="closeComposer"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
