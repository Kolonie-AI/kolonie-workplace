import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { TASK_GATEWAY } from '@/gateway/provide-gateway'
import { createFixtureTaskGateway } from '@/gateway/fixture-task-gateway'
import { FIXTURE_BOARDS, FIXTURE_HUMANS } from '@/fixtures/catalogue'
import AppShell from '@/shell/AppShell.vue'
import { createFixtureWorkplaceSession } from '@/session/fixture-workplace-session'
import { WORKPLACE_SESSION } from '@/session/workplace-session'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

const REQUIRED_ARIA_LABELS = [
  'Close filter',
  'Close the work item',
  'Kolonie AI',
  'Search cards, members, labels, and more.',
  'Close keyboard shortcuts',
] as const

function vueFiles(): readonly string[] {
  return [
    'src/shell/AppShell.vue',
    'src/detail/DetailPane.vue',
    'src/kanban/LaneComposer.vue',
    'src/kanban/KanbanCard.vue',
    'src/kanban/KanbanBoard.vue',
    'src/boards/BoardList.vue',
    'src/session/SignedInHuman.vue',
  ]
}

describe('named controls — every interactive control has an accessible name', () => {
  it('keeps the required aria-labels in source, so removing one fails this test', () => {
    const sources = vueFiles().map((file) =>
      readFileSync(resolve(process.cwd(), file), 'utf8'),
    )
    const joined = sources.join('\n')

    for (const name of REQUIRED_ARIA_LABELS) {
      expect(joined).toContain(`aria-label="${name}"`)
    }
  })

  it('names every rendered button, input and select on a signed-in board', async () => {
    const session = createFixtureWorkplaceSession()
    await session.signIn({ humanId: FIXTURE_HUMANS.wren })
    render(AppShell, {
      props: { initialBoardId: FIXTURE_BOARDS.quillDelivery },
      global: {
        provide: {
          [WORKPLACE_SESSION]: session,
          [TASK_GATEWAY]: createFixtureTaskGateway(),
        },
      },
    })

    await waitFor(() => {
      expect(screen.queryAllByTestId('kanban-card').length).toBeGreaterThan(0)
    })

    await fireEvent.click(screen.getByTestId('filter-open'))
    await waitFor(() => {
      expect(screen.getByTestId('filter-popover')).toBeTruthy()
    })

    const controls = screen.getByTestId('app-shell').querySelectorAll(
      'button, input, select, textarea, [role="tab"], [role="dialog"]',
    )

    for (const control of controls) {
      const name =
        control.getAttribute('aria-label') ??
        control.getAttribute('aria-labelledby') ??
        control.textContent?.replace(/\s+/g, ' ').trim() ??
        ''

      expect(name.length, control.outerHTML.slice(0, 160)).toBeGreaterThan(0)
    }
  })
})
