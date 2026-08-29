<script setup lang="ts">
/*
 * Copyright 2026 Kolonie AI FZ-LLC.
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Data reaches this component only through TaskGateway.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useWorkplaceClock } from '@/clock/workplace-clock'
import {
  WORKPLACE_VIEWS,
  WORKPLACE_VIEW_LABELS,
  resolveWorkplaceView,
  type WorkplaceView,
} from '@/shell/views'
import type {
  AttachmentId,
  BoardId,
  ChecklistItemId,
  CommentId,
  CreateAttachmentInput,
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
  assigneesOf,
  isBoardFilterActive,
  labelsOf,
  ownersOf,
  parseBoardFilter,
  withBoardFilterInQuery,
  type BoardFilter,
  type BoardFilterDue,
} from '@/items/board-filter'
import DetailPane from '@/detail/DetailPane.vue'
import { revokeAllPreviews, revokePreview } from '@/detail/attachment-previews'
import { useItemDetail } from '@/detail/use-item-detail'
import { useTaskGateway } from '@/gateway/provide-gateway'
import { isPreviewDataGateway } from '@/gateway/task-gateway'
import SignedInHuman from '@/session/SignedInHuman.vue'
import { useSignedInHuman } from '@/session/use-session'
import { trapFocus } from '@/a11y/focus-trap'
import { WORKPLACE_SHORTCUTS, isTypingTarget } from '@/shell/shortcuts'
import '@/shell/app-shell.css'

const props = defineProps<{
  initialView?: unknown
  initialBoardId?: BoardId
  initialQuery?: string
}>()

const activeView = ref<WorkplaceView>(resolveWorkplaceView(props.initialView))
const tabRefs = useTemplateRef<HTMLButtonElement[]>('tabs')
const searchInput = useTemplateRef<HTMLInputElement>('searchInput')
const filterOpenButton = useTemplateRef<HTMLButtonElement>('filterOpenButton')

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
const items = useBoardItems(gateway, humanId, activeBoardId, boardFilter, clock)
const filterOpen = ref(false)
const shortcutOpen = ref(false)
const filterPopover = useTemplateRef<HTMLElement>('filterPopover')
const shortcutOverlay = useTemplateRef<HTMLElement>('shortcutOverlay')
const detail = useItemDetail(gateway, humanId, items.selectedItemId)

const filterOwners = computed(() => ownersOf(items.loadedItems.value))
const filterAssignees = computed(() => assigneesOf(items.loadedItems.value))
const filterLabels = computed(() => labelsOf(items.loadedItems.value))
const isFiltered = computed(() => isBoardFilterActive(boardFilter.value))

watch(
  [activeBoardId, items.status, filterOwners, filterAssignees, filterLabels],
  ([boardId, status, owners, assignees, labels]) => {
    if (boardId === null || status !== 'ready') {
      return
    }

    if (boardFilter.value.owner !== '' && !owners.includes(boardFilter.value.owner)) {
      setOwner('')
    }

    if (
      boardFilter.value.assignee !== '' &&
      boardFilter.value.assignee !== 'none' &&
      !assignees.some((assignee) => assignee.id === boardFilter.value.assignee)
    ) {
      setAssignee('')
    }

    if (
      boardFilter.value.label !== '' &&
      !labels.some((label) => label.id === boardFilter.value.label)
    ) {
      setLabel('')
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

function setAssignee(assignee: string): void {
  boardFilter.value = { ...boardFilter.value, assignee }
}

function setLabel(label: string): void {
  boardFilter.value = { ...boardFilter.value, label }
}

function setDue(due: BoardFilterDue | ''): void {
  boardFilter.value = { ...boardFilter.value, due }
}

function clearFilter(): void {
  boardFilter.value = EMPTY_BOARD_FILTER
}

async function openFilter(): Promise<void> {
  filterOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}

function closeFilter(): void {
  filterOpen.value = false
  void nextTick(() => {
    filterOpenButton.value?.focus()
  })
}

function closeShortcuts(): void {
  shortcutOpen.value = false
}

function onFilterKeydown(event: KeyboardEvent): void {
  trapFocus(filterPopover.value ?? (event.currentTarget as HTMLElement), event)

  if (event.key !== 'Escape' || event.isComposing) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  closeFilter()
}

function onShortcutKeydown(event: KeyboardEvent): void {
  trapFocus(shortcutOverlay.value ?? (event.currentTarget as HTMLElement), event)

  if (event.key !== 'Escape' || event.isComposing) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  closeShortcuts()
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (event.isComposing || isTypingTarget(event.target)) {
    return
  }

  if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
    event.preventDefault()
    shortcutOpen.value = !shortcutOpen.value
    return
  }

  if (event.key === 'f' || event.key === 'F') {
    if (boardList.activeBoard.value === null) {
      return
    }

    event.preventDefault()
    if (filterOpen.value) {
      closeFilter()
    } else {
      void openFilter()
    }
  }
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!filterOpen.value) {
    return
  }

  const target = event.target

  if (!(target instanceof Node)) {
    return
  }

  if (filterPopover.value?.contains(target) === true) {
    return
  }

  if (filterOpenButton.value?.contains(target) === true) {
    return
  }

  closeFilter()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  window.addEventListener('keydown', onWindowKeydown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  window.removeEventListener('keydown', onWindowKeydown)
  revokeAllPreviews()
})

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
  void openFilter()
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

async function addAttachment(input: CreateAttachmentInput): Promise<WorkItemDetail | null> {
  return applyDetail(await detail.addAttachment(input))
}

async function deleteAttachment(attachmentId: AttachmentId): Promise<WorkItemDetail | null> {
  const itemId = detail.item.value?.id
  const updated = applyDetail(await detail.deleteAttachment(attachmentId))

  if (updated !== null && itemId !== undefined) {
    revokePreview(itemId, attachmentId)
  }

  return updated
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
          :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          :aria-expanded="sidebarCollapsed ? 'false' : 'true'"
          @click="toggleSidebar"
        />
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
        class="app-shell__board-header"
        data-testid="board-header"
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
          class="app-shell__mark app-shell__mark--header"
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
        <h1
          v-if="boardList.activeBoard.value !== null"
          class="app-shell__title"
          data-testid="active-board"
          :data-board-id="boardList.activeBoard.value.id"
        >
          {{ boardList.activeBoard.value.title }}
        </h1>
        <div class="app-shell__board-toolbar">
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

          <div
            v-if="boardList.activeBoard.value !== null"
            class="app-shell__filter"
          >
            <button
              ref="filterOpenButton"
              class="app-shell__filter-open"
              type="button"
              data-testid="filter-open"
              title="Filter cards F"
              aria-haspopup="dialog"
              :aria-expanded="filterOpen ? 'true' : 'false'"
              @click="filterOpen ? closeFilter() : openFilter()"
            >
              Filter cards
            </button>
            <button
              class="app-shell__search-button"
              type="button"
              @click="focusBoardSearch"
            >
              Search this board
            </button>
            <button
              v-if="isFiltered"
              class="app-shell__filter-clear"
              type="button"
              data-testid="filter-clear"
              @click="clearFilter"
            >
              Clear all filters
            </button>
            <div
              v-if="filterOpen"
              ref="filterPopover"
              class="app-shell__filter-popover"
              data-testid="filter-popover"
              role="dialog"
              aria-modal="true"
              aria-labelledby="filter-heading"
              tabindex="-1"
              @keydown="onFilterKeydown"
            >
              <div class="app-shell__filter-popover-head">
                <h2
                  id="filter-heading"
                  class="app-shell__filter-heading"
                >
                  Filter
                </h2>
                <button
                  class="app-shell__filter-close"
                  type="button"
                  data-testid="filter-close"
                  aria-label="Close filter"
                  @click="closeFilter"
                >
                  Close
                </button>
              </div>

              <label class="app-shell__filter-field">
                <span class="app-shell__filter-label">Keyword</span>
                <input
                  ref="searchInput"
                  class="app-shell__filter-search"
                  data-testid="filter-search"
                  type="search"
                  placeholder="Enter a keyword…"
                  aria-label="Search cards, members, labels, and more."
                  :value="boardFilter.search"
                  @input="setSearch(($event.target as HTMLInputElement).value)"
                >
              </label>

              <label class="app-shell__filter-field">
                <span class="app-shell__filter-label">Members</span>
                <select
                  class="app-shell__filter-assignee"
                  data-testid="filter-assignee"
                  :value="boardFilter.assignee"
                  @change="setAssignee(($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Every member</option>
                  <option value="none">No members</option>
                  <option
                    v-for="assignee in filterAssignees"
                    :key="assignee.id"
                    :value="assignee.id"
                  >
                    {{ assignee.name }}
                  </option>
                </select>
              </label>

              <label class="app-shell__filter-field">
                <span class="app-shell__filter-label">Labels</span>
                <select
                  class="app-shell__filter-label-select"
                  data-testid="filter-label"
                  :value="boardFilter.label"
                  @change="setLabel(($event.target as HTMLSelectElement).value)"
                >
                  <option value="">Every label</option>
                  <option
                    v-for="label in filterLabels"
                    :key="label.id"
                    :value="label.id"
                  >
                    {{ label.title }}
                  </option>
                </select>
              </label>

              <label class="app-shell__filter-field">
                <span class="app-shell__filter-label">Due date</span>
                <select
                  class="app-shell__filter-due"
                  data-testid="filter-due"
                  :value="boardFilter.due"
                  @change="setDue(($event.target as HTMLSelectElement).value as BoardFilterDue | '')"
                >
                  <option value="">Any date</option>
                  <option value="has">Has dates</option>
                  <option value="overdue">Overdue</option>
                  <option value="none">No dates</option>
                </select>
              </label>

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
            </div>
          </div>
        </div>
        <span
          v-if="showsPreviewData"
          class="app-shell__preview-data"
          data-testid="preview-data-indication"
        >Example data</span>
        <SignedInHuman />
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

        <p
          v-else-if="boardList.selectionFailure.value === 'unreadable'"
          class="app-shell__read-error"
          data-testid="board-unreadable"
          role="alert"
        >
          That board could not be read. This is a read failure, not a statement
          about whether this human may open it.
        </p>

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
              @reorder="items.reorderItem"
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
            :shows-preview-data="showsPreviewData"
            @update="updateDetail"
            @create-checklist-item="createChecklistItem"
            @update-checklist-item="updateChecklistItem"
            @reorder-checklist-item="reorderChecklistItem"
            @delete-checklist-item="deleteChecklistItem"
            @delete-checklist="deleteChecklist"
            @create-comment="createComment"
            @update-comment="updateComment"
            @delete-comment="deleteComment"
            @add-attachment="addAttachment"
            @delete-attachment="deleteAttachment"
            @close="closeDetail"
          />
        </div>
      </main>
    </div>

    <div
      v-if="shortcutOpen"
      ref="shortcutOverlay"
      class="app-shell__shortcuts"
      data-testid="shortcut-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-heading"
      tabindex="-1"
      @keydown="onShortcutKeydown"
    >
      <div class="app-shell__shortcuts-head">
        <h2
          id="shortcut-heading"
          class="app-shell__shortcuts-heading"
        >
          Keyboard shortcuts
        </h2>
        <button
          class="app-shell__shortcuts-close"
          type="button"
          data-testid="shortcut-close"
          aria-label="Close keyboard shortcuts"
          @click="closeShortcuts"
        >
          Close
        </button>
      </div>
      <dl class="app-shell__shortcuts-list">
        <div
          v-for="shortcut in WORKPLACE_SHORTCUTS"
          :key="shortcut.key"
          class="app-shell__shortcuts-row"
        >
          <dt>
            <kbd>{{ shortcut.key }}</kbd>
          </dt>
          <dd>{{ shortcut.label }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>
