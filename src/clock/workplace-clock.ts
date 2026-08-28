import { inject, provide, type InjectionKey } from 'vue'

export const WORKPLACE_CLOCK: InjectionKey<() => Date> = Symbol('workplaceClock')

const systemClock = (): Date => new Date()

export function provideWorkplaceClock(now: () => Date = systemClock): () => Date {
  provide(WORKPLACE_CLOCK, now)

  return now
}

export function useWorkplaceClock(): () => Date {
  return inject(WORKPLACE_CLOCK, systemClock)
}
