import { inject, provide, type InjectionKey } from 'vue'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { createHttpTaskGateway } from '@/gateway/http-task-gateway'
import type { TaskGateway } from '@/gateway/task-gateway'
import {
  isWorkplaceConfigAbsent,
  readLiveWorkplaceConfig,
} from '@/session/live-config'
import type { WorkplaceSession } from '@/session/workplace-session'

/**
 * The single composition point where an implementation of the workplace port
 * is chosen. Board components resolve the port and never an implementation of
 * it, so a generated platform client replaces this file and nothing else.
 */
export const TASK_GATEWAY: InjectionKey<TaskGateway> = Symbol('taskGateway')

export function createTaskGateway(
  session?: WorkplaceSession,
  env: Readonly<Record<string, string | undefined>> = import.meta.env as unknown as Record<
    string,
    string | undefined
  >,
): TaskGateway {
  if (isWorkplaceConfigAbsent(env)) {
    return createFixtureTaskGateway()
  }

  const config = readLiveWorkplaceConfig(env)
  if (session?.getAccessToken === undefined) {
    throw new Error('Kolonie Workplace: live gateway composition needs the live session.')
  }

  return createHttpTaskGateway({
    origin: config.platformOrigin,
    getToken: () => session.getAccessToken!(),
    getCitizen: () => {
      const selected = session.currentHuman.value
      return selected === null ? null : { id: selected.id, handle: selected.name }
    },
  })
}

export function provideTaskGateway(gateway: TaskGateway): TaskGateway {
  provide(TASK_GATEWAY, gateway)

  return gateway
}

export function useTaskGateway(): TaskGateway {
  const gateway = inject(TASK_GATEWAY, null)

  if (gateway === null) {
    throw new Error('Kolonie Workplace: no TaskGateway was provided to this component.')
  }

  return gateway
}
