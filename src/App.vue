<script setup lang="ts">
import SessionGate from '@/session/SessionGate.vue'
import { provideWorkplaceSession } from '@/session/provide-session'
import '@/styles/tokens.css'

provideWorkplaceSession()
</script>

<template>
  <SessionGate />
</template>
