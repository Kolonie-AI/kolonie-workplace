<script setup lang="ts">
import { computed } from 'vue'
import AppShell from '@/shell/AppShell.vue'
import SignedOutView from '@/session/SignedOutView.vue'
import { useOptionalWorkplaceSession, useSignedInHuman } from '@/session/use-session'
import '@/session/session.css'

const session = useOptionalWorkplaceSession()
const human = useSignedInHuman()
const agents = computed(() => session?.linkedAgents?.value ?? null)
const isLiveSession = computed(() => session?.linkedAgents !== undefined)

function pickCitizen(citizenId: string): void {
  session?.pickCitizen?.(citizenId)
}

async function signOut(): Promise<void> {
  await session?.signOut()
}
</script>

<template>
  <AppShell v-if="human !== null" />
  <section
    v-else-if="isLiveSession && agents !== null"
    class="session-signed-out"
    data-testid="citizen-gate"
  >
    <div class="session-signed-out__panel">
      <h1 class="session-signed-out__title">
        Choose a citizen
      </h1>
      <p
        v-if="agents.length === 0"
        class="session-signed-out__lead"
        data-testid="no-linked-citizens"
      >
        This human operates nobody, so there is no citizen workspace to open.
      </p>
      <template v-else>
        <p class="session-signed-out__lead">
          Choose which linked citizen you are acting as. Every board request will use that
          citizen's id.
        </p>
        <ul class="session-signed-out__candidates">
          <li
            v-for="agent in agents"
            :key="agent.id"
          >
            <button
              class="session-signed-out__candidate"
              type="button"
              :data-citizen-id="agent.id"
              @click="pickCitizen(agent.id)"
            >
              Continue as {{ agent.handle }}
            </button>
          </li>
        </ul>
      </template>
      <button
        class="session-human__sign-out"
        type="button"
        @click="signOut"
      >
        Sign out
      </button>
    </div>
  </section>
  <SignedOutView v-else />
</template>
