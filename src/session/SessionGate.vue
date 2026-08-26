<script setup lang="ts">
import AppShell from '@/shell/AppShell.vue'
import SignedOutView from '@/session/SignedOutView.vue'
import { useSignedInHuman } from '@/session/use-session'

const human = useSignedInHuman()
</script>

<template>
  <AppShell v-if="human !== null" />
  <SignedOutView v-else />
</template>
