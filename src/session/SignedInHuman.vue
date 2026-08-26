<script setup lang="ts">
import { useOptionalWorkplaceSession, useSignedInHuman } from '@/session/use-session'
import '@/session/session.css'

const session = useOptionalWorkplaceSession()
const human = useSignedInHuman()

async function signOut(): Promise<void> {
  await session?.signOut()
}
</script>

<template>
  <div
    v-if="human !== null"
    class="session-human"
    data-testid="signed-in-human"
  >
    <span class="session-human__name">Signed in as {{ human.name }}</span>
    <button
      class="session-human__sign-out"
      type="button"
      @click="signOut"
    >
      Sign out
    </button>
  </div>
</template>
