import { describe, expect, it } from 'vitest'
import { FixtureTaskGateway, createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { PREVIEW_DATA_GATEWAY } from '@/gateway/task-gateway'
import { fixtureBoards, fixtureWorkItems, FIXTURE_BOARDS, FIXTURE_HUMANS } from '@/fixtures/catalogue'

const WRITE_LIKE = /^(create|update|delete|remove|save|persist|write|set|move|add|patch|put|sync|reorder)/

describe('the gateway write surface', () => {
  it('exposes the reads and named writes without persistence', () => {
    const methods = Object.getOwnPropertyNames(FixtureTaskGateway.prototype).filter(
      (name) => name !== 'constructor' && !name.startsWith('require') && name !== 'replace',
    )
    const symbols = Object.getOwnPropertySymbols(createFixtureTaskGateway())

    expect(methods.sort()).toEqual([
      'addAttachment',
      'createChecklistItem',
      'createComment',
      'createWorkItem',
      'deleteAttachment',
      'deleteChecklistItem',
      'deleteComment',
      'deleteWorkItem',
      'getBoardItems',
      'getItemDetail',
      'listVisibleBoards',
      'moveItemToLane',
      'reorderChecklistItem',
      'reorderWorkItem',
      'updateChecklistItem',
      'updateComment',
      'updateWorkItem',
    ])
    expect(methods.filter((name) => WRITE_LIKE.test(name)).sort()).toEqual([
      'addAttachment',
      'createChecklistItem',
      'createComment',
      'createWorkItem',
      'deleteAttachment',
      'deleteChecklistItem',
      'deleteComment',
      'deleteWorkItem',
      'moveItemToLane',
      'reorderChecklistItem',
      'reorderWorkItem',
      'updateChecklistItem',
      'updateComment',
      'updateWorkItem',
    ])
    expect(symbols).toEqual([PREVIEW_DATA_GATEWAY])
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
