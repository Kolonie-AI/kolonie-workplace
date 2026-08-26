import { inject, provide, type InjectionKey } from 'vue'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import type { TaskGateway } from '@/gateway/task-gateway'

/**
 * The single composition point where an implementation of the read port is
 * chosen. Board components resolve the port and never an implementation of it,
 * so a generated platform client replaces this file and nothing else.
 */
export const TASK_GATEWAY: InjectionKey<TaskGateway> = Symbol('taskGateway')

export function createTaskGateway(): TaskGateway {
  return createFixtureTaskGateway()
}

export function provideTaskGateway(gateway: TaskGateway = createTaskGateway()): TaskGateway {
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
