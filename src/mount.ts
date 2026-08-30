import { createApp, type App as VueApp } from 'vue'
import App from '@/App.vue'
import { createWorkplaceSession, provideWorkplaceSession } from '@/session/provide-session'
import { startSession } from '@/session/sign-in-callback'
import type { WorkplaceSession } from '@/session/workplace-session'
import type { TaskGateway } from '@/gateway/task-gateway'

export function mountWorkplace(
  selector: string,
  session?: WorkplaceSession,
  gateway?: TaskGateway,
): VueApp<Element> {
  const target = document.querySelector(selector)

  if (target === null) {
    throw new Error(`Kolonie Workplace: mount target "${selector}" was not found.`)
  }

  const app = createApp(App, {
    ...(session === undefined ? {} : { session }),
    ...(gateway === undefined ? {} : { gateway }),
  })
  app.mount(target)

  return app
}

/**
 * The entry point, which differs from `mountWorkplace` in one way that matters:
 * it settles the session *before* mounting.
 *
 * Returning from the hosted login and then rendering the signed-out screen for
 * a frame — while the code is exchanged — would show a person who has just
 * signed in a page telling them they have not. Awaiting first costs one render
 * and removes that entirely.
 */
export async function startWorkplace(selector: string): Promise<VueApp<Element>> {
  const session = createWorkplaceSession()

  await startSession(session, window.location.href)

  return mountWorkplace(selector, session)
}

export { provideWorkplaceSession }
