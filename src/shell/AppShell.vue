<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import {
  WORKPLACE_VIEWS,
  WORKPLACE_VIEW_LABELS,
  resolveWorkplaceView,
  type WorkplaceView,
} from '@/shell/views'
import type { BoardId } from '@/domain/workplace'
import BoardList from '@/boards/BoardList.vue'
import { useBoardList } from '@/boards/use-board-list'
import KanbanBoard from '@/kanban/KanbanBoard.vue'
import ListView from '@/list/ListView.vue'
import { useBoardItems } from '@/items/use-board-items'
import DetailPane from '@/detail/DetailPane.vue'
import { useItemDetail } from '@/detail/use-item-detail'
import { useTaskGateway } from '@/gateway/provide-gateway'
import { isPreviewDataGateway } from '@/gateway/task-gateway'
import SignedInHuman from '@/session/SignedInHuman.vue'
import { useSignedInHuman } from '@/session/use-session'
import '@/shell/app-shell.css'

const props = defineProps<{
  initialView?: unknown
  initialBoardId?: BoardId
}>()

const activeView = ref<WorkplaceView>(resolveWorkplaceView(props.initialView))
const tabRefs = useTemplateRef<HTMLButtonElement[]>('tabs')

const human = useSignedInHuman()
const humanId = computed(() => human.value?.id ?? null)
const gateway = useTaskGateway()
const showsPreviewData = isPreviewDataGateway(gateway)
const boardList = useBoardList(gateway, humanId)
const activeBoardId = computed(() => boardList.activeBoard.value?.id ?? null)
const items = useBoardItems(gateway, humanId, activeBoardId)
const detail = useItemDetail(gateway, humanId, items.selectedItemId)

watch(
  () => boardList.status.value,
  (status) => {
    if (status === 'ready' && props.initialBoardId !== undefined) {
      void boardList.selectBoard(props.initialBoardId)
    }
  },
  { immediate: true },
)

function selectBoard(boardId: BoardId): void {
  void boardList.selectBoard(boardId)
}

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
      <BoardList
        :status="boardList.status.value"
        :groups="boardList.groups.value"
        :is-empty="boardList.isEmpty.value"
        :active-board-id="boardList.activeBoard.value?.id ?? null"
        @select="selectBoard"
      />
    </aside>

    <div class="app-shell__workspace">
      <header
        class="app-shell__topbar"
        data-testid="topbar"
      >
        <span class="app-shell__workplace-name">Kolonie Workplace</span>
        <span
          v-if="showsPreviewData"
          class="app-shell__preview-data"
          data-testid="preview-data-indication"
        >Example data</span>
        <SignedInHuman />
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
        <p
          v-if="boardList.refusal.value !== null"
          class="app-shell__refusal"
          data-testid="board-refused"
          role="alert"
        >
          {{ boardList.refusal.value }}
        </p>

        <section
          v-if="boardList.activeBoard.value !== null"
          class="app-shell__active-board"
          data-testid="active-board"
          :data-board-id="boardList.activeBoard.value.id"
        >
          <h2 class="app-shell__active-board-title">
            {{ boardList.activeBoard.value.title }}
          </h2>
          <p class="app-shell__active-board-agent">
            {{ boardList.activeBoard.value.agentName }}
          </p>
        </section>

        <div
          class="app-shell__board-area"
          :data-detail-open="items.selectedItemId.value === null ? 'false' : 'true'"
        >
          <section
            id="board-canvas"
            class="app-shell__canvas"
            role="tabpanel"
            :aria-labelledby="`view-tab-${activeView}`"
            :data-view="activeView"
          >
            <KanbanBoard
              v-if="activeView === 'kanban'"
              :status="items.status.value"
              :columns="items.columns.value"
              :invalid="items.invalid.value"
              :is-board-empty="items.isBoardEmpty.value"
              :selected-item-id="items.selectedItemId.value"
              @select="items.selectItem"
            />

            <ListView
              v-else-if="activeView === 'list'"
              :status="items.status.value"
              :rows="items.rows.value"
              :invalid="items.invalid.value"
              :is-board-empty="items.isBoardEmpty.value"
              :selected-item-id="items.selectedItemId.value"
              @select="items.selectItem"
            />
          </section>

          <DetailPane
            v-if="items.selectedItemId.value !== null"
            :status="detail.status.value"
            :item="detail.item.value"
            @close="items.clearSelection"
          />
        </div>
      </main>
    </div>
  </div>
</template>
