<script setup lang="ts">
import { ref } from 'vue'
import type { BoardId } from '@/domain/workplace'
import type { BoardGroup } from '@/boards/board-groups'
import type { BoardListStatus } from '@/boards/use-board-list'
import '@/boards/board-list.css'

const props = defineProps<{
  status: BoardListStatus
  groups: readonly BoardGroup[]
  isEmpty: boolean
  activeBoardId: BoardId | null
  canManage: boolean
  mutationError: string | null
}>()

const emit = defineEmits<{
  select: [boardId: BoardId]
  create: [title: string]
  rename: [boardId: BoardId, title: string]
  archive: [boardId: BoardId]
}>()

const creating = ref(false)
const draftTitle = ref('')
const editingBoardId = ref<BoardId | null>(null)
const editingTitle = ref('')

function submitCreate(): void {
  const title = draftTitle.value.trim()
  if (title === '') {
    return
  }

  emit('create', title)
  draftTitle.value = ''
  creating.value = false
}

function startRename(boardId: BoardId, title: string): void {
  editingBoardId.value = boardId
  editingTitle.value = title
}

function submitRename(): void {
  const boardId = editingBoardId.value
  const title = editingTitle.value.trim()
  if (boardId === null || title === '') {
    return
  }

  emit('rename', boardId, title)
  editingBoardId.value = null
  editingTitle.value = ''
}

function archive(boardId: BoardId): void {
  if (props.activeBoardId === boardId || props.groups.some((group) => group.boards.some((board) => board.id === boardId))) {
    emit('archive', boardId)
  }
}
</script>

<template>
  <nav
    class="board-list"
    aria-label="Boards"
  >
    <div class="board-list__heading">
      <p class="board-list__title">
        Boards
      </p>
      <button
        v-if="canManage"
        class="board-list__action"
        type="button"
        aria-label="Create board"
        @click="creating = true"
      >
        +
      </button>
    </div>

    <form
      v-if="creating"
      class="board-list__composer"
      @submit.prevent="submitCreate"
    >
      <label>
        Board title
        <input
          v-model="draftTitle"
          name="board-title"
          maxlength="120"
          autofocus
        >
      </label>
      <div class="board-list__composer-actions">
        <button type="submit">
          Create
        </button>
        <button
          type="button"
          @click="creating = false"
        >
          Cancel
        </button>
      </div>
    </form>

    <p
      v-if="mutationError !== null"
      class="board-list__state board-list__state--error"
      role="alert"
    >
      {{ mutationError }}
    </p>

    <p
      v-if="status === 'loading'"
      class="board-list__state"
      data-testid="boards-loading"
    >
      Loading your boards…
    </p>

    <p
      v-else-if="status === 'error'"
      class="board-list__state board-list__state--error"
      data-testid="boards-error"
      role="alert"
    >
      Your boards could not be loaded. This is a failure to read them, not a
      statement about which boards you may open.
    </p>

    <p
      v-else-if="isEmpty"
      class="board-list__state"
      data-testid="boards-empty"
    >
      You may open no boards. Boards belong to the agents you operate, and none
      of them holds one.
    </p>

    <ul
      v-else
      class="board-list__groups"
    >
      <li
        v-for="group in groups"
        :key="group.agentId"
        class="board-list__group"
        data-testid="board-group"
        :data-agent-id="group.agentId"
      >
        <p class="board-list__agent">
          {{ group.agentName }}
        </p>
        <ul class="board-list__boards">
          <li
            v-for="board in group.boards"
            :key="board.id"
            class="board-list__row"
          >
            <form
              v-if="editingBoardId === board.id"
              class="board-list__composer"
              @submit.prevent="submitRename"
            >
              <label>
                Board title
                <input
                  v-model="editingTitle"
                  maxlength="120"
                  autofocus
                >
              </label>
              <div class="board-list__composer-actions">
                <button type="submit">
                  Save
                </button>
                <button
                  type="button"
                  @click="editingBoardId = null"
                >
                  Cancel
                </button>
              </div>
            </form>
            <template v-else>
              <button
                class="board-list__board"
                type="button"
                data-testid="board-link"
                :data-board-id="board.id"
                :aria-current="activeBoardId === board.id ? 'page' : undefined"
                @click="emit('select', board.id)"
              >
                {{ board.title }}
              </button>
              <div
                v-if="canManage"
                class="board-list__row-actions"
              >
                <button
                  type="button"
                  :aria-label="`Rename ${board.title}`"
                  @click="startRename(board.id, board.title)"
                >
                  Rename
                </button>
                <button
                  type="button"
                  :aria-label="`Archive ${board.title}`"
                  @click="archive(board.id)"
                >
                  Archive
                </button>
              </div>
            </template>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>
