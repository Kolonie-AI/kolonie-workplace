<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Data reaches this component only through TaskGateway.
 */
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useWorkplaceClock } from '@/clock/workplace-clock'
import {
  WORKPLACE_VIEWS,
  WORKPLACE_VIEW_LABELS,
  resolveWorkplaceView,
  type WorkplaceView,
} from '@/shell/views'
import type {
  BoardId,
  ChecklistItemId,
  CommentId,
  UpdateChecklistItemInput,
  UpdateWorkItemInput,
  WorkItemAssignee,
  WorkItemDetail,
  WorkItemLabel,
} from '@/domain/workplace'
import { WORKPLACE_LANES, WORKPLACE_LANE_LABELS, type Lane } from '@/domain/lanes'
import BoardList from '@/boards/BoardList.vue'
import { useBoardList } from '@/boards/use-board-list'
import KanbanBoard from '@/kanban/KanbanBoard.vue'
import ListView from '@/list/ListView.vue'
import { useBoardItems } from '@/items/use-board-items'
import {
  EMPTY_BOARD_FILTER,
  isBoardFilterActive,
  ownersOf,
  parseBoardFilter,
  withBoardFilterInQuery,
  type BoardFilter,
} from '@/items/board-filter'
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
  initialQuery?: string
}>()

const activeView = ref<WorkplaceView>(resolveWorkplaceView(props.initialView))
const tabRefs = useTemplateRef<HTMLButtonElement[]>('tabs')
const searchInput = useTemplateRef<HTMLInputElement>('searchInput')

/**
 * Chrome state, kept in the shell because nothing else needs it: the desktop
 * sidebar can collapse to give the board the full row, and below the mobile
 * breakpoint the same sidebar becomes an overlay the menu button opens.
 * Selecting a board closes the overlay.
 */
const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)

const human = useSignedInHuman()
const humanId = computed(() => human.value?.id ?? null)
const gateway = useTaskGateway()
const clock = useWorkplaceClock()
const now = computed(() => clock())
const showsPreviewData = isPreviewDataGateway(gateway)
const boardList = useBoardList(gateway, humanId)
const activeBoardId = computed(() => boardList.activeBoard.value?.id ?? null)

/**
 * The filter is read from the URL once and written back to it as it changes,
 * so a filtered board can be shared or bookmarked. It is browser state over one
 * already-loaded board: nothing about it reaches the gateway, and nothing about
 * it is saved anywhere.
 */
const boardFilter = ref<BoardFilter>(
  parseBoardFilter(props.initialQuery ?? window.location.search),
)
const items = useBoardItems(gateway, humanId, activeBoardId, boardFilter)
const detail = useItemDetail(gateway, humanId, items.selectedItemId)

const filterOwners = computed(() => ownersOf(items.loadedItems.value))
const isFiltered = computed(() => isBoardFilterActive(boardFilter.value))

watch(
  [activeBoardId, items.status, filterOwners],
  ([boardId, status, owners]) => {
    if (
      boardId !== null &&
      status === 'ready' &&
      boardFilter.value.owner !== '' &&
      !owners.includes(boardFilter.value.owner)
    ) {
      setOwner('')
    }
  },
)

watch(
  boardFilter,
  (filter) => {
    const query = withBoardFilterInQuery(window.location.search, filter)

    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query}${window.location.hash}`,
    )
  },
  { deep: true, immediate: true },
)

function toggleLane(lane: Lane): void {
  const lanes = boardFilter.value.lanes

  boardFilter.value = {
    ...boardFilter.value,
    lanes: lanes.includes(lane)
      ? lanes.filter((candidate) => candidate !== lane)
      : [...lanes, lane],
  }
}

function setOwner(owner: string): void {
  boardFilter.value = { ...boardFilter.value, owner }
}

function setSearch(search: string): void {
  boardFilter.value = { ...boardFilter.value, search }
}

function clearFilter(): void {
  boardFilter.value = EMPTY_BOARD_FILTER
}

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
  mobileMenuOpen.value = false
  void boardList.selectBoard(boardId)
}

function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function focusBoardSearch(): void {
  searchInput.value?.focus()
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

const availableLabels = computed<readonly WorkItemLabel[]>(() => {
  const labels = new Map<string, WorkItemLabel>()

  for (const item of items.loadedItems.value) {
    for (const label of item.labels) {
      labels.set(label.id, label)
    }
  }

  return [...labels.values()].sort((left, right) => left.title.localeCompare(right.title))
})

const availableAssignees = computed<readonly WorkItemAssignee[]>(() => {
  const assignees = new Map<string, WorkItemAssignee>()

  for (const item of items.loadedItems.value) {
    for (const assignee of item.assignees) {
      assignees.set(assignee.id, assignee)
    }
  }

  return [...assignees.values()].sort((left, right) => left.name.localeCompare(right.name))
})

function applyDetail(updated: WorkItemDetail | null): WorkItemDetail | null {
  if (updated !== null) {
    items.replaceItem(updated)
  }

  return updated
}

async function updateDetail(input: UpdateWorkItemInput): Promise<WorkItemDetail | null> {
  return applyDetail(await detail.updateItem(input))
}

async function createChecklistItem(title: string): Promise<WorkItemDetail | null> {
  return applyDetail(await detail.createChecklistItem(title))
}

async function updateChecklistItem(
  checklistItemId: ChecklistItemId,
  input: UpdateChecklistItemInput,
): Promise<WorkItemDetail | null> {
  return applyDetail(await detail.updateChecklistItem(checklistItemId, input))
}

async function reorderChecklistItem(
  checklistItemId: ChecklistItemId,
  position: number,
): Promise<WorkItemDetail | null> {
  return applyDetail(await detail.reorderChecklistItem(checklistItemId, position))
}

async function deleteChecklistItem(
  checklistItemId: ChecklistItemId,
): Promise<WorkItemDetail | null> {
  return applyDetail(await detail.deleteChecklistItem(checklistItemId))
}

async function deleteChecklist(): Promise<void> {
  const current = detail.item.value

  if (current === null) {
    return
  }

  for (const entry of [...current.checklist].sort((left, right) => right.position - left.position)) {
    const updated = await detail.deleteChecklistItem(entry.id)

    if (updated === null) {
      return
    }

    items.replaceItem(updated)
  }
}

async function createComment(body: string): Promise<WorkItemDetail | null> {
  const author = human.value?.name

  if (author === undefined) {
    return null
  }

  return applyDetail(await detail.createComment(author, body))
}

async function updateComment(commentId: CommentId, body: string): Promise<WorkItemDetail | null> {
  return applyDetail(await detail.updateComment(commentId, body))
}

async function deleteComment(commentId: CommentId): Promise<WorkItemDetail | null> {
  return applyDetail(await detail.deleteComment(commentId))
}

function openItem(itemId: string): void {
  items.selectItem(itemId)
}

async function closeDetail(): Promise<void> {
  const itemId = items.selectedItemId.value
  items.clearSelection()
  await nextTick()

  if (itemId === null) {
    return
  }

  const opener = document.querySelector(
    `[data-testid="kanban-card"][data-item-id="${itemId}"], [data-testid="list-row"][data-item-id="${itemId}"]`,
  )

  if (opener instanceof HTMLElement) {
    opener.focus()
  }
}
</script>

<template>
  <div
    class="app-shell"
    data-testid="app-shell"
    :data-sidebar-collapsed="sidebarCollapsed ? 'true' : 'false'"
    :data-mobile-menu-open="mobileMenuOpen ? 'true' : 'false'"
  >
    <aside
      class="app-shell__sidebar"
      data-testid="sidebar"
      :aria-label="sidebarCollapsed ? 'Collapsed board navigation' : 'Board navigation'"
    >
      <div class="app-shell__sidebar-head">
        <p class="app-shell__brand">
          Kolonie
        </p>
        <button
          class="app-shell__sidebar-toggle"
          type="button"
          :aria-expanded="sidebarCollapsed ? 'false' : 'true'"
          @click="toggleSidebar"
        >
          {{ sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar' }}
        </button>
      </div>
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
        <button
          class="app-shell__menu-button"
          type="button"
          :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
          :aria-label="mobileMenuOpen ? 'Close board navigation' : 'Open board navigation'"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <span
            class="app-shell__menu-lines"
            aria-hidden="true"
          />
        </button>
        <svg
          class="app-shell__mark app-shell__mark--topbar"
          viewBox="0 0 64 64"
          role="img"
          aria-label="Kolonie AI"
        >
          <g
            fill="none"
            stroke-width="5"
            stroke-linejoin="miter"
            stroke-linecap="butt"
            stroke-miterlimit="6"
          >
            <path
              d="M32 10 L51 15 C51 32 46 45.5 32 55 C18 45.5 13 32 13 15 Z"
              class="app-shell__mark-crest"
            />
            <path
              d="M24.5 21 L31.5 28 L24.5 35"
              class="app-shell__mark-crest"
            />
            <path
              d="M39.5 21 L39.5 35"
              class="app-shell__mark-stem"
            />
          </g>
        </svg>
        <span class="app-shell__workplace-name">Kolonie Workplace</span>
        <span
          v-if="boardList.activeBoard.value !== null"
          class="app-shell__topbar-board-title"
        >{{ boardList.activeBoard.value.title }}</span>
        <button
          class="app-shell__search-button"
          type="button"
          :disabled="boardList.activeBoard.value === null"
          @click="focusBoardSearch"
        >
          Search this board
        </button>
        <span
          v-if="showsPreviewData"
          class="app-shell__preview-data"
          data-testid="preview-data-indication"
        >Example data. Moves are session-local and not recorded.</span>
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

      <section
        v-if="boardList.activeBoard.value !== null"
        class="app-shell__filters"
        data-testid="board-filters"
        aria-label="Filter this board"
      >
        <div
          class="app-shell__filter-lanes"
          role="group"
          aria-label="Filter by lane"
        >
          <button
            v-for="lane in WORKPLACE_LANES"
            :key="lane"
            class="app-shell__filter-lane"
            type="button"
            :data-testid="`filter-lane-${lane}`"
            :aria-pressed="boardFilter.lanes.includes(lane)"
            @click="toggleLane(lane)"
          >
            {{ WORKPLACE_LANE_LABELS[lane] }}
          </button>
        </div>

        <label class="app-shell__filter-field">
          <span class="app-shell__filter-label">Owner</span>
          <select
            class="app-shell__filter-owner"
            data-testid="filter-owner"
            :value="boardFilter.owner"
            @change="setOwner(($event.target as HTMLSelectElement).value)"
          >
            <option value="">Every owner</option>
            <option
              v-for="owner in filterOwners"
              :key="owner"
              :value="owner"
            >
              {{ owner }}
            </option>
          </select>
        </label>

        <label class="app-shell__filter-field">
          <span class="app-shell__filter-label">Search titles</span>
          <input
            ref="searchInput"
            class="app-shell__filter-search"
            data-testid="filter-search"
            type="search"
            :value="boardFilter.search"
            @input="setSearch(($event.target as HTMLInputElement).value)"
          >
        </label>

        <button
          v-if="isFiltered"
          class="app-shell__filter-clear"
          type="button"
          data-testid="filter-clear"
          @click="clearFilter"
        >
          Clear all filters
        </button>
      </section>

      <main class="app-shell__main">
        <p
          v-if="boardList.refusal.value !== null"
          class="app-shell__refusal"
          data-testid="board-refused"
          role="alert"
        >
          {{ boardList.refusal.value }}
        </p>

        <p
          v-else-if="boardList.selectionFailure.value === 'unreadable'"
          class="app-shell__read-error"
          data-testid="board-unreadable"
          role="alert"
        >
          That board could not be read. This is a read failure, not a statement
          about whether this human may open it.
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
          <p class="app-shell__active-board-profession">
            {{ boardList.activeBoard.value.profession ?? 'Profession not declared' }}
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
              :is-filter-empty="items.isFilterEmpty.value"
              :selected-item-id="items.selectedItemId.value"
              :moving-item-id="items.movingItemId.value"
              :move-error="items.moveError.value"
              :create-error="items.createError.value"
              :now="now"
              @select="openItem"
              @move="items.moveItem"
              @create="items.createItem"
            />

            <ListView
              v-else-if="activeView === 'list'"
              :status="items.status.value"
              :rows="items.rows.value"
              :invalid="items.invalid.value"
              :is-board-empty="items.isBoardEmpty.value"
              :is-filter-empty="items.isFilterEmpty.value"
              :selected-item-id="items.selectedItemId.value"
              :moving-item-id="items.movingItemId.value"
              :move-error="items.moveError.value"
              @select="openItem"
              @move="items.moveItem"
            />
          </section>

          <DetailPane
            v-if="items.selectedItemId.value !== null"
            :status="detail.status.value"
            :item="detail.item.value"
            :update-error="detail.updateError.value"
            :available-labels="availableLabels"
            :available-assignees="availableAssignees"
            :now="now"
            :current-human-name="human?.name ?? null"
            @update="updateDetail"
            @create-checklist-item="createChecklistItem"
            @update-checklist-item="updateChecklistItem"
            @reorder-checklist-item="reorderChecklistItem"
            @delete-checklist-item="deleteChecklistItem"
            @delete-checklist="deleteChecklist"
            @create-comment="createComment"
            @update-comment="updateComment"
            @delete-comment="deleteComment"
            @close="closeDetail"
          />
        </div>
      </main>
    </div>
  </div>
</template>
