import { describe, expect, it } from 'vitest'
import type { WorkItemDetail } from '@/domain/workplace'
import { BoardAccessRefused, WorkItemAccessRefused } from '@/gateway/refusals'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS, FIXTURE_ITEMS } from '@/fixtures/catalogue'

describe('fixture gateway writes', () => {
  it('creates an item for this instance only', async () => {
    const gateway = createFixtureTaskGateway()
    const created = await gateway.createWorkItem(FIXTURE_HUMANS.wren, {
      boardId: FIXTURE_BOARDS.quillDelivery,
      title: 'Prepare the fictional release note',
      lane: 'ready',
    })

    expect(
      (await gateway.getBoardItems(FIXTURE_HUMANS.wren, FIXTURE_BOARDS.quillDelivery))
        .map(({ id }) => id),
    ).toContain(created.id)
    expect(
      (await createFixtureTaskGateway().getBoardItems(
        FIXTURE_HUMANS.wren,
        FIXTURE_BOARDS.quillDelivery,
      )).map(({ id }) => id),
    ).not.toContain(created.id)
  })

  it('updates, reorders and deletes an item', async () => {
    const gateway = createFixtureTaskGateway()

    const updated = await gateway.updateWorkItem(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, {
      title: 'Revised fictional delivery outline',
      priority: 'high',
      dueDate: '2026-09-04',
      percentDone: 40,
    })
    expect(updated).toMatchObject({
      title: 'Revised fictional delivery outline',
      priority: 'high',
      dueDate: '2026-09-04',
      percentDone: 40,
    })

    await gateway.reorderWorkItem(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, {
      lane: 'review',
      position: 1,
    })
    expect(await gateway.getItemDetail(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready))
      .toMatchObject({ lane: 'review', position: 1 })

    await gateway.deleteWorkItem(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready)
    await expect(
      gateway.getItemDetail(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready),
    ).rejects.toBeInstanceOf(WorkItemAccessRefused)
  })

  it('adds, edits and deletes comments', async () => {
    const gateway = createFixtureTaskGateway()
    const added = await gateway.createComment(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, {
      author: 'Fictional Human Wren',
      body: '<p>Please review the fictional outline.</p>',
    })
    expect(added.comments).toHaveLength(1)

    const edited = await gateway.updateComment(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      added.comments[0]!.id,
      '<p>Reviewed the fictional outline.</p>',
    )
    expect(edited.comments[0]?.body).toContain('Reviewed')

    const removed = await gateway.deleteComment(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      added.comments[0]!.id,
    )
    expect(removed.comments).toEqual([])
  })

  it('adds and deletes attachments', async () => {
    const gateway = createFixtureTaskGateway()
    const added = await gateway.addAttachment(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, {
      name: 'fictional-outline.txt',
      size: 128,
      mimeType: 'text/plain',
    })
    expect(added.attachments).toHaveLength(1)

    const removed = await gateway.deleteAttachment(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      added.attachments[0]!.id,
    )
    expect(removed.attachments).toEqual([])
  })

  it('keeps attachment and colour covers exclusive and clears a deleted cover attachment', async () => {
    const gateway = createFixtureTaskGateway()
    const image = new File(['fictional image'], 'fictional-cover.png', { type: 'image/png' })
    const added = await gateway.addAttachment(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.inProgress, {
      name: image.name,
      size: image.size,
      mimeType: image.type,
      file: image,
    })
    const attachmentId = added.attachments.at(-1)!.id

    const imageCovered = await gateway.updateWorkItem(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.inProgress,
      {
        coverAttachmentId: attachmentId,
        coverImageUrl: 'blob:fictional-cover',
      },
    )
    expect(imageCovered).toMatchObject({
      coverAttachmentId: attachmentId,
      coverColour: null,
      coverImageUrl: 'blob:fictional-cover',
    })

    const colourCovered = await gateway.updateWorkItem(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.inProgress,
      { coverColour: '#00db60' },
    )
    expect(colourCovered).toMatchObject({
      coverAttachmentId: null,
      coverColour: '#00db60',
      coverImageUrl: null,
    })

    await gateway.updateWorkItem(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.inProgress, {
      coverAttachmentId: attachmentId,
      coverImageUrl: 'blob:fictional-cover',
    })
    const removed = await gateway.deleteAttachment(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.inProgress,
      attachmentId,
    )
    expect(removed).toMatchObject({
      coverAttachmentId: null,
      coverColour: null,
      coverImageUrl: null,
    })
  })

  it('refuses a non-image attachment as an image cover', async () => {
    const gateway = createFixtureTaskGateway()
    const item = await gateway.getItemDetail(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.inProgress)

    await expect(
      gateway.updateWorkItem(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.inProgress, {
        coverAttachmentId: item.attachments[0]!.id,
        coverImageUrl: 'blob:not-an-image',
      }),
    ).rejects.toBeInstanceOf(WorkItemAccessRefused)
  })

  it('adds, updates, reorders and deletes checklist items', async () => {
    const gateway = createFixtureTaskGateway()
    const added = await gateway.createChecklistItem(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      'Draft fictional introduction',
    )
    const checklistId = added.checklist[0]!.id

    const updated = await gateway.updateChecklistItem(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      checklistId,
      { title: 'Draft fictional opening', done: true },
    )
    expect(updated.checklist[0]).toMatchObject({
      title: 'Draft fictional opening',
      done: true,
    })

    const second = await gateway.createChecklistItem(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      'Review fictional opening',
    )
    const reordered = await gateway.reorderChecklistItem(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      second.checklist[1]!.id,
      0,
    )
    expect(reordered.checklist.map(({ title }) => title)).toEqual([
      'Review fictional opening',
      'Draft fictional opening',
    ])

    const removed = await gateway.deleteChecklistItem(
      FIXTURE_HUMANS.wren,
      FIXTURE_ITEMS.ready,
      checklistId,
    )
    expect(removed.checklist.map(({ id }) => id)).not.toContain(checklistId)
  })

  it('refuses writes to a board this human cannot open', async () => {
    const gateway = createFixtureTaskGateway()

    await expect(
      gateway.createWorkItem(FIXTURE_HUMANS.wren, {
        boardId: FIXTURE_BOARDS.marlowOutreach,
        title: 'Invisible fictional item',
        lane: 'ready',
      }),
    ).rejects.toBeInstanceOf(BoardAccessRefused)
    await expect(
      gateway.updateWorkItem(FIXTURE_HUMANS.wren, 'fictional-item-foreign', {
        title: 'Invisible fictional edit',
      }),
    ).rejects.toBeInstanceOf(WorkItemAccessRefused)
  })

  it('rejects deletion of an unknown item rather than silently succeeding', async () => {
    const gateway = createFixtureTaskGateway()

    await expect(
      gateway.deleteWorkItem(FIXTURE_HUMANS.wren, 'fictional-item-unknown'),
    ).rejects.toBeInstanceOf(WorkItemAccessRefused)
  })

  it('adds and removes a vault-name link without a value field', async () => {
    const gateway = createFixtureTaskGateway()

    const created = await gateway.addCardLink(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready, {
      kind: 'vault',
      ref: 'fictional/mailbox',
    })
    expect(created).toMatchObject({
      kind: 'vault',
      ref: 'fictional/mailbox',
      summary: 'fictional/mailbox',
      state: 'resolved',
    })
    expect(created).not.toHaveProperty('value')
    expect(
      (await gateway.getItemDetail(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready)).links,
    ).toEqual([created])

    await gateway.removeCardLink(FIXTURE_HUMANS.wren, created.id)
    expect(
      (await gateway.getItemDetail(FIXTURE_HUMANS.wren, FIXTURE_ITEMS.ready)).links,
    ).toEqual([])
  })

  it('returns summary fields needed by a board card', async () => {
    const gateway = createFixtureTaskGateway()
    const items = await gateway.getBoardItems(
      FIXTURE_HUMANS.wren,
      FIXTURE_BOARDS.quillDelivery,
    )
    const detailed = items.find((item) => item.id === FIXTURE_ITEMS.inProgress)

    expect(detailed).toMatchObject({
      description: expect.any(String),
      labels: expect.any(Array),
      assignees: expect.any(Array),
      priority: expect.any(String),
      checklist: expect.any(Array),
      comments: expect.any(Array),
      attachments: expect.any(Array),
      position: expect.any(Number),
    } satisfies Partial<WorkItemDetail>)
  })
})
