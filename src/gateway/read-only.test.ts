import { describe, expect, it } from 'vitest'
import { FixtureTaskGateway, createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { fixtureBoards, fixtureWorkItems, FIXTURE_BOARDS, FIXTURE_HUMANS } from '@/fixtures/catalogue'

const WRITE_LIKE = /^(create|update|delete|remove|save|persist|write|set|move|add|patch|put|sync)/

describe('the gateway is read-only', () => {
  it('exposes no write, create, update, delete or persistence method', () => {
    const methods = Object.getOwnPropertyNames(FixtureTaskGateway.prototype).filter(
      (name) => name !== 'constructor',
    )

    expect(methods.sort()).toEqual(['getBoardItems', 'getItemDetail', 'listVisibleBoards'])
    expect(methods.filter((name) => WRITE_LIKE.test(name))).toEqual([])
  })

  it('leaves the fixture catalogue unchanged after reads', async () => {
    const gateway = createFixtureTaskGateway()
    const boardsBefore = JSON.stringify(fixtureBoards)
    const itemsBefore = JSON.stringify(fixtureWorkItems)

    await gateway.listVisibleBoards(FIXTURE_HUMANS.wren)
    await gateway.getBoardItems(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)

    expect(JSON.stringify(fixtureBoards)).toBe(boardsBefore)
    expect(JSON.stringify(fixtureWorkItems)).toBe(itemsBefore)
  })

  it('never touches browser or file persistence while serving a read', async () => {
    const gateway = createFixtureTaskGateway()
    const touched: string[] = []
    const watch = (label: string, storage: Storage) =>
      new Proxy(storage, {
        get(target, property, receiver) {
          touched.push(`${label}.${String(property)}`)
          return Reflect.get(target, property, receiver) as unknown
        },
      })

    const originalLocal = globalThis.localStorage
    const originalSession = globalThis.sessionStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: watch('localStorage', originalLocal),
      configurable: true,
    })
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: watch('sessionStorage', originalSession),
      configurable: true,
    })

    try {
      await gateway.listVisibleBoards(FIXTURE_HUMANS.wren)
      await gateway.getBoardItems(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery)
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocal,
        configurable: true,
      })
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: originalSession,
        configurable: true,
      })
    }

    expect(touched).toEqual([])
  })
})
