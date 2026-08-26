<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import {
  WORKPLACE_VIEWS,
  WORKPLACE_VIEW_LABELS,
  resolveWorkplaceView,
  type WorkplaceView,
} from '@/shell/views'
import '@/shell/app-shell.css'

const props = defineProps<{
  initialView?: unknown
}>()

const activeView = ref<WorkplaceView>(resolveWorkplaceView(props.initialView))
const activeLabel = computed(() => WORKPLACE_VIEW_LABELS[activeView.value])
const tabRefs = useTemplateRef<HTMLButtonElement[]>('tabs')

function selectView(view: WorkplaceView): void {
  activeView.value = view
}

function focusTab(index: number): void {
  tabRefs.value?.[index]?.focus()
}

function moveToTab(index: number): void {
  const view = WORKPLACE_VIEWS[index]

  if (view === undefined) {
    return
  }

  selectView(view)
  focusTab(index)
}

function onTabKeydown(event: KeyboardEvent, index: number): void {
  const last = WORKPLACE_VIEWS.length - 1

  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault()
      moveToTab(index === last ? 0 : index + 1)
      break
    case 'ArrowLeft':
      event.preventDefault()
      moveToTab(index === 0 ? last : index - 1)
      break
    case 'Home':
      event.preventDefault()
      moveToTab(0)
      break
    case 'End':
      event.preventDefault()
      moveToTab(last)
      break
    default:
      break
  }
}
</script>

<template>
  <div class="app-shell">
    <aside
      class="app-shell__sidebar"
      data-testid="sidebar"
    >
      <p class="app-shell__brand">
        Kolonie
      </p>
      <nav aria-label="Boards">
        <p class="app-shell__nav-title">
          Boards
        </p>
        <span class="app-shell__board-link">Work board</span>
      </nav>
    </aside>

    <div class="app-shell__workspace">
      <header
        class="app-shell__topbar"
        data-testid="topbar"
      >
        <span class="app-shell__workplace-name">Kolonie Workplace</span>
        <span class="app-shell__human-menu">Human menu</span>
      </header>

      <header
        class="app-shell__board-header"
        data-testid="board-header"
      >
        <h1 class="app-shell__title">
          Work board
        </h1>
        <div
          class="app-shell__tabs"
          role="tablist"
          aria-label="Board views"
        >
          <button
            v-for="(view, index) in WORKPLACE_VIEWS"
            :id="`view-tab-${view}`"
            :key="view"
            ref="tabs"
            class="app-shell__tab"
            type="button"
            role="tab"
            aria-controls="board-canvas"
            :aria-selected="activeView === view"
            :tabindex="activeView === view ? 0 : -1"
            @click="selectView(view)"
            @keydown="onTabKeydown($event, index)"
          >
            {{ WORKPLACE_VIEW_LABELS[view] }}
          </button>
        </div>
      </header>

      <main class="app-shell__main">
        <section
          id="board-canvas"
          class="app-shell__canvas"
          role="tabpanel"
          :aria-labelledby="`view-tab-${activeView}`"
          :data-view="activeView"
        >
          <h2 class="app-shell__placeholder-title">
            {{ activeLabel }} canvas
          </h2>
          <p class="app-shell__placeholder-note">
            Placeholder content for the {{ activeLabel.toLowerCase() }} view.
          </p>
        </section>
      </main>
    </div>
  </div>
</template>
