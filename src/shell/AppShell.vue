<script setup lang="ts">
import { computed, ref } from 'vue'
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

function selectView(view: WorkplaceView): void {
  activeView.value = view
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
            v-for="view in WORKPLACE_VIEWS"
            :id="`view-tab-${view}`"
            :key="view"
            class="app-shell__tab"
            type="button"
            role="tab"
            :aria-controls="'board-canvas'"
            :aria-selected="activeView === view"
            @click="selectView(view)"
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
