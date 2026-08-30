<script setup lang="ts">
import SessionGate from '@/session/SessionGate.vue'
import { provideWorkplaceClock } from '@/clock/workplace-clock'
import { createTaskGateway, provideTaskGateway } from '@/gateway/provide-gateway'
import { provideWorkplaceSession } from '@/session/provide-session'
import type { WorkplaceSession } from '@/session/workplace-session'
import type { TaskGateway } from '@/gateway/task-gateway'
import '@/styles/tokens.css'

/**
 * The session may be handed in already settled — the entry point completes a
 * sign-in redirect before mounting, so the signed-out screen never flashes
 * between the callback and the resolved human. With none given, one is created
 * here exactly as before.
 */
const props = defineProps<{
  session?: WorkplaceSession
  gateway?: TaskGateway
}>()

const session = provideWorkplaceSession(props.session)
provideWorkplaceClock()
provideTaskGateway(props.gateway ?? createTaskGateway(session))
</script>

<template>
  <SessionGate />
</template>
