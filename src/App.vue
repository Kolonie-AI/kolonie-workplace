<script setup lang="ts">
import SessionGate from '@/session/SessionGate.vue'
import { provideTaskGateway } from '@/gateway/provide-gateway'
import { provideWorkplaceSession } from '@/session/provide-session'
import '@/styles/tokens.css'

provideWorkplaceSession()
provideTaskGateway()
</script>

<template>
  <SessionGate />
</template>
