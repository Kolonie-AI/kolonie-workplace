<script setup lang="ts">
import { computed } from 'vue'
import { useOptionalWorkplaceSession, useSignedInHuman } from '@/session/use-session'
import '@/session/session.css'

const session = useOptionalWorkplaceSession()
const human = useSignedInHuman()
const activeDelegation = computed(() => session?.activeDelegation?.value ?? null)

async function signOut(): Promise<void> {
  await session?.signOut()
}

function switchCitizen(): void {
  session?.switchCitizen?.()
}
</script>

<template>
  <div
    v-if="human !== null"
    class="session-human"
    data-testid="signed-in-human"
  >
    <span
      v-if="activeDelegation !== null"
      class="session-human__delegated-badge"
      data-testid="delegated-perspective"
    >
      Operating {{ activeDelegation.subjectHandle }} via {{ activeDelegation.viaHandle }}
    </span>
    <span class="session-human__name">Signed in as {{ human.name }}</span>
    <button
      v-if="session?.switchCitizen !== undefined"
      class="session-human__sign-out"
      type="button"
      @click="switchCitizen"
    >
      Switch citizen
    </button>
    <button
      class="session-human__sign-out"
      type="button"
      @click="signOut"
    >
      Sign out
    </button>
  </div>
</template>
