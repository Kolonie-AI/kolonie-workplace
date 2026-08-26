<script setup lang="ts">
import SessionGate from '@/session/SessionGate.vue'
import { provideTaskGateway } from '@/gateway/provide-gateway'
import { provideWorkplaceSession } from '@/session/provide-session'
import type { WorkplaceSession } from '@/session/workplace-session'
import '@/styles/tokens.css'

/**
 * The session may be handed in already settled — the entry point completes a
 * sign-in redirect before mounting, so the signed-out screen never flashes
 * between the callback and the resolved human. With none given, one is created
 * here exactly as before.
 */
const props = defineProps<{ session?: WorkplaceSession }>()

provideWorkplaceSession(props.session)
provideTaskGateway()
</script>

<template>
  <SessionGate />
</template>
