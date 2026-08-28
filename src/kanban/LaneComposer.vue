<script setup lang="ts">
/*
 * Copyright 2018-present Vikunja and contributors. All rights reserved.
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * The per-lane Add-card composer is adapted for Kolonie Workplace on
 * 2026-08-27 from Vikunja 2.5.0 (ef2200e9429c5cc42f5c1811433418bfcc72b3aa):
 *   frontend/src/components/project/views/ProjectKanban.vue
 *   frontend/src/components/tasks/AddTask.vue
 * No Vikunja store, router, i18n or task model is used; creating a card
 * reaches the gateway only through the board's createItem call.
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
const input = useTemplateRef<HTMLInputElement>('composerInput')
const addButton = useTemplateRef<HTMLButtonElement>('addButton')

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
  if (event.key === 'Enter') {
    event.preventDefault()
    submit()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeComposer()
  }
}

function onBlur(): void {
  if (title.value.trim() === '') {
    closeComposer()
  }
}
</script>

<template>
  <div class="lane-composer">
    <button
      v-if="!open"
      ref="addButton"
      class="lane-composer__add"
      type="button"
      :aria-label="`Add card to ${laneLabel}`"
      @click="openComposer"
    >
      Add card
    </button>
    <input
      v-else
      ref="composerInput"
      v-model="title"
      class="lane-composer__input"
      type="text"
      :aria-label="`Card title for ${laneLabel}`"
      placeholder="Card title"
      @keydown="onKeydown"
      @blur="onBlur"
    >
  </div>
</template>
