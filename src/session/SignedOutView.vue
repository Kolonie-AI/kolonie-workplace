<script setup lang="ts">
import { computed, ref } from 'vue'
import { asDevelopmentSignIn } from '@/session/development-sign-in'
import { SignInRefused } from '@/session/refusals'
import { useOptionalWorkplaceSession } from '@/session/use-session'
import '@/session/session.css'

const session = useOptionalWorkplaceSession()
const developmentSignIn = session === null ? null : asDevelopmentSignIn(session)
const candidates = computed(() => developmentSignIn?.listSignInCandidates() ?? [])
const refusal = ref<string | null>(null)

async function chooseHuman(humanId: string): Promise<void> {
  if (session === null) {
    return
  }

  refusal.value = null

  try {
    await session.signIn({ humanId })
  } catch (error) {
    refusal.value =
      error instanceof SignInRefused
        ? error.message
        : 'Kolonie Workplace: that sign-in could not be completed.'
  }
}
</script>

<template>
  <div
    class="session-signed-out"
    data-testid="signed-out"
  >
    <section
      class="session-signed-out__panel"
      aria-labelledby="signed-out-title"
    >
      <h1
        id="signed-out-title"
        class="session-signed-out__title"
      >
        Kolonie Workplace
      </h1>
      <p class="session-signed-out__lead">
        Nobody is signed in, so no board is loaded.
      </p>

      <div
        v-if="candidates.length > 0"
        data-testid="fixture-sign-in"
      >
        <p class="session-signed-out__development-note">
          Development affordance — this fixture picker stands in for the real login and
          asks for no credential. It is replaced when authentication arrives.
        </p>
        <ul class="session-signed-out__candidates">
          <li
            v-for="human in candidates"
            :key="human.id"
          >
            <button
              class="session-signed-out__candidate"
              type="button"
              @click="chooseHuman(human.id)"
            >
              Continue as {{ human.name }}
            </button>
          </li>
        </ul>
      </div>

      <p
        v-if="refusal !== null"
        class="session-signed-out__refusal"
        role="alert"
      >
        {{ refusal }}
      </p>
    </section>
  </div>
</template>
