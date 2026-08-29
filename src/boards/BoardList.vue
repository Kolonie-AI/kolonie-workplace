<script setup lang="ts">
import type { BoardId } from '@/domain/workplace'
import type { BoardGroup } from '@/boards/board-groups'
import type { BoardListStatus } from '@/boards/use-board-list'
import '@/boards/board-list.css'

defineProps<{
  status: BoardListStatus
  groups: readonly BoardGroup[]
  isEmpty: boolean
  activeBoardId: BoardId | null
}>()

const emit = defineEmits<{
  select: [boardId: BoardId]
}>()
</script>

<template>
  <nav
    class="board-list"
    aria-label="Boards"
  >
    <p class="board-list__title">
      Boards
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
          >
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
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>
