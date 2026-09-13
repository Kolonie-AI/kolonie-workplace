<script setup lang="ts">
import { computed } from 'vue'
import AppShell from '@/shell/AppShell.vue'
import SignedOutView from '@/session/SignedOutView.vue'
import { useOptionalWorkplaceSession, useSignedInHuman } from '@/session/use-session'
import '@/session/session.css'

const session = useOptionalWorkplaceSession()
const human = useSignedInHuman()
const agents = computed(() => session?.linkedAgents?.value ?? null)
const delegations = computed(() => session?.delegatedCitizens?.value ?? null)
const failure = computed(() => session?.failure?.value ?? null)
const isLiveSession = computed(() => session?.linkedAgents !== undefined)

function pickCitizen(citizenId: string): void {
  session?.pickCitizen?.(citizenId)
}

function pickDelegatedCitizen(delegationId: string): void {
  session?.pickDelegatedCitizen?.(delegationId)
}

async function signOut(): Promise<void> {
  await session?.signOut()
}

async function signInAgain(): Promise<void> {
  await session?.signIn()
}
</script>

<template>
  <AppShell v-if="human !== null" />
  <section
    v-else-if="failure === 'unauthorized'"
    class="session-signed-out"
    data-testid="session-unauthorized"
  >
    <div class="session-signed-out__panel">
      <h1 class="session-signed-out__title">
        Session expired
      </h1>
      <p class="session-signed-out__lead">
        Sign in again to return to the workplace.
      </p>
      <button
        class="session-signed-out__candidate"
        type="button"
        @click="signInAgain"
      >
        Sign in again
      </button>
    </div>
  </section>
  <section
    v-else-if="failure === 'forbidden'"
    class="session-signed-out"
    data-testid="session-forbidden"
  >
    <div class="session-signed-out__panel">
      <h1 class="session-signed-out__title">
        Workplace deployment error
      </h1>
      <p class="session-signed-out__lead">
        This origin is not allowed to call the Colony. Fix the deployment configuration.
      </p>
    </div>
  </section>
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
        v-if="agents.length === 0 && (delegations === null || delegations.length === 0)"
        class="session-signed-out__lead"
        data-testid="no-linked-citizens"
      >
        This human operates nobody and holds no delegated workspace to open.
      </p>
      <template v-else>
        <p class="session-signed-out__lead">
          Choose a directly operated citizen or a delegated perspective.
        </p>
        <section
          v-if="agents.length > 0"
          class="session-signed-out__choice-group"
          data-testid="direct-citizen-choices"
        >
          <h2 class="session-signed-out__choice-title">
            Your citizens
          </h2>
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
        </section>
        <section
          v-if="delegations !== null && delegations.length > 0"
          class="session-signed-out__choice-group session-signed-out__choice-group--delegated"
          data-testid="delegated-citizen-choices"
        >
          <h2 class="session-signed-out__choice-title">
            Delegated citizens
          </h2>
          <ul class="session-signed-out__candidates">
            <li
              v-for="delegation in delegations"
              :key="delegation.delegationId"
            >
              <button
                class="session-signed-out__candidate"
                type="button"
                :data-delegation-id="delegation.delegationId"
                @click="pickDelegatedCitizen(delegation.delegationId)"
              >
                Operate {{ delegation.subjectHandle }} (via {{ delegation.viaHandle }})
              </button>
            </li>
          </ul>
        </section>
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
