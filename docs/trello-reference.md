# Trello MVP reference for Workplace

Measured 2026-08-28 from Colette Reprise's working Trello demo board. This is
the visual and interaction baseline for package
[#73](https://github.com/Kolonie-AI/kolonie-workplace/issues/73). Workers
rebuild **behaviour and hierarchy**. They **do not copy Trello source**, CSS,
assets, logos or proprietary copy.

Public Trello help pages confirm shapes that were also measured on the live
board. They are not a substitute for this document:

- https://support.atlassian.com/trello/docs/adding-cards/
- https://support.atlassian.com/trello/docs/adding-checklists-to-cards/
- https://support.atlassian.com/trello/docs/adding-attachments-to-cards/
- https://support.atlassian.com/trello/docs/filtering-for-cards-on-a-board/
- https://support.atlassian.com/trello/docs/moving-cards-or-lists/

Workplace `main` at the measurement (`2386bbe`) is already a six-lane board
with a typed `TaskGateway`. The gap is density, chrome and interaction, not
“invent Kanban”.

## Three durable facts

1. **Trello** supplies appearance and interactions. Rebuild them by
   observation. Do not copy Trello source, CSS, assets, logos or proprietary
   copy.
2. **Hermes Kanban** supplies lifecycle semantics. Workplace lanes stay the
   six fixed statuses in `src/domain/lanes.ts`: `inbox`, `ready`,
   `in_progress`, `blocked`, `review`, `done`. Inbox maps to Hermes Triage.
   Workplace **must not grow a seventh list**. Lists do not drag, rename or
   delete.
3. Colette has Vault-backed persistent Trello research access. Credentials
   live only in the Kolonie Vault under `trello/colette-reprise`. Browser
   research uses the persistent Camofox profile. This file may name that
   Vault key. It must not contain a password, OTP, cookie, token, private
   board URL or a screenshot that leaks private data.

Vikunja is a rejected former reference. Provenance and reuse permission leave
the tree in [#74](https://github.com/Kolonie-AI/kolonie-workplace/issues/74).
Later visual children must not cite Vikunja reuse.

`TaskGateway` remains the only write seam. Fixture data is allowed. Do not
invent a `kolonie-platform` schema.

## Measured Trello board (2026-08-28)

### Board chrome

- Compact global bar: search, create, notifications, account.
- Board-local toolbar: title, Views, members, Power-Ups, Automation,
  **Filter cards**, star, visibility, Share, menu.
- One horizontally scrolling row of lists. Empty lists still occupy a well.
  Trello offers `Add another list`. Workplace **must not grow a seventh
  list**.

Workplace already has a dark sidebar, a board title and a search field in
`src/shell/*`. The restyle is the board canvas, list wells and white cards —
not a Trello global bar and not a Trello-restyle of list view.

### List

- Rounded pale well. Heading + count + collapse + overflow menu.
- Card stack, then a collapsed control labelled **Add a card**.
- Activating it opens an **inline composer inside the list**: textarea
  “Enter a title or paste a link”, **Add card**, cancel. Enter submits,
  Escape cancels. The composer stays at the **bottom**.

Workplace already places `LaneComposer` at the bottom of each lane. The
control currently reads `Add card` and is a single-line input with no
Add-card / cancel pair. Restyle is [#75](https://github.com/Kolonie-AI/kolonie-workplace/issues/75).
Collapse and the overflow menu are Trello chrome; Workplace lists are
lifecycle states, so collapse/overflow that would hide or mutate a lane are
deferred.

### Card face

- White elevated rectangle. Optional cover. Title.
- Compact zero-suppressed badges: description present, attachment count,
  checklist `done/total`, comments, members.
- Trello has a separate “mark complete” control. Workplace maps completion
  to the **Done lane**, not a second complete bit.

Workplace `KanbanCard.vue` already shows a colour stripe, text labels, an
owner string, a Blocked flag, a `percentDone` bar, due date, `done/total`
and comment/attachment counts, plus an always-visible **Move to lane**
`<select>`. The restyle hides that select from the face, turns labels into
colour-first chips, and adds a cover slot. That is
[#76](https://github.com/Kolonie-AI/kolonie-workplace/issues/76).

### Card back (modal over the still-visible board)

- Cover/header, inline title, current-list control (“in list …”).
- Compact actions: Add / Labels / Dates / Checklist / Members (not a
  graveyard of empty buttons).
- Main column: Description, Attachments, named checklists (title, %,
  progress bar, items, Add an item, Delete).
- Separate **Comments and activity** region with “Write a comment…”.
- Escape / close restores the board; the opening card remains the context.

Measured popovers on the live card back (2026-08-28):

- **Labels** — search + create.
- **Dates** — month grid + due date.
- **Add checklist** — Title default “Checklist” + Add. Copy/generate
  deferred.
- **Members** — search + add.

Workplace `DetailPane.vue` is a stacked side pane (~789 lines). The restyle
is a two-region modal in
[#77](https://github.com/Kolonie-AI/kolonie-workplace/issues/77). MVP uses
**one unnamed checklist section** per card
([#78](https://github.com/Kolonie-AI/kolonie-workplace/issues/78)); do not
invent nested named checklists.

### Filter popover (`Filter cards`, shortcut F)

- Keyword; Members (no members / assigned to me); Card status; Due date
  windows; Activity windows; “Collapse lists with no matching cards”.
- Workplace MVP implements keyword + assignee + label + due (has / overdue /
  none). Activity windows, complete-bit and list-collapse are deferred
  unless already cheap.

Workplace `src/items/board-filter.ts` already encodes `lane` / `owner` / `q`
in the URL. Keep URL encoding. The popover is
[#82](https://github.com/Kolonie-AI/kolonie-workplace/issues/82).

### Movement

- Cards reorder **inside** a list and move **between** lists.
- Lists themselves drag in Trello. Workplace lists are lifecycle states and
  **lists do not drag**.

Workplace already drops a card onto a target lane (`moveItemToLane`) and
exposes `reorderWorkItem` on the gateway. Within-list reorder is not yet
modelled in the Kanban. That is
[#81](https://github.com/Kolonie-AI/kolonie-workplace/issues/81).

## File matrix

Current Workplace (`main` `2386bbe`) — files a worker actually touches.
Every path maps to one package issue or an explicit “unchanged/deferred”.

| Surface | Current | Gap | Owner |
|---|---|---|---|
| Lanes | `src/domain/lanes.ts` — fixed `inbox` / `ready` / `in_progress` / `blocked` / `review` / `done` | Keep. Do not add user lists. | unchanged |
| Domain | `src/domain/workplace.ts` — summary, detail, labels, assignees, checklist, comments, attachments, `coverColour`, `position` | Fixture-only `coverAttachmentId` exclusive with `coverColour` | #80 |
| Board | `src/kanban/KanbanBoard.vue` + `kanban-board.css` — CSS grid of bordered lanes, empty copy, composer already at bottom, “Drag a card…” hint | Restyle to Trello list wells; drop instructional chrome | #75 |
| Card | `src/kanban/KanbanCard.vue` + `card-facets.ts` — title, text labels, owner string, Blocked flag, percentDone bar, due, `done/total`, counts, **always-visible Move to lane `<select>`** | Trello badge row; hide the select from the face; cover image + colour | #76 |
| Composer | `src/kanban/LaneComposer.vue` — open/close, Enter/Escape, single-line input, label `Add card` | Restyle to Trello inline composer (textarea + Add card + cancel) | #75 |
| Detail | `src/detail/DetailPane.vue` (~789 lines) stacked fields | Trello two-region card-back modal; Labels / Dates / Members popovers | #77 |
| Checklists | Gateway verbs exist; card face shows `done/total`; detail has no checklist editor | One unnamed checklist section on the card back | #78 |
| Activity | “Comments and activity” on the card back: composer at the bottom, newest-last thread, edit/delete own comment, face count | Attachments and covers | #80 |
| Attachments / covers | Gateway attachment verbs exist; colour stripe on the face; `coverColour` on the summary | Fixture-memory attachments; cover from image or colour, exclusive | #80 |
| Tokens / shell | `src/styles/tokens.css`, `src/shell/*` — dark sidebar, current colour story | Trello board canvas / list well / white cards. List view stays as a secondary view and is not Trello-restyled in #75 | #75 (board canvas); list view unchanged |
| Filter | `src/items/board-filter.ts` — URL `lane` / `owner` / `q` | Trello filter popover; keep URL encoding; add label + due | #82 |
| Writes | `src/gateway/task-gateway.ts` already has create / update / move / **reorder** / comment / attachment / checklist verbs | UI must use them; do not invent a second store | unchanged |
| Drag | Card `draggable`; drop on a lane emits `move`; within-lane order is not modelled | Within-list reorder + keep cross-list move; lists do not drag | #81 |
| Empty / loading / a11y | Board already has idle / loading / error / empty / no-match copy | Finish pass with filter, keyboard and `?` | #82 |
| Policy | `NOTICE`, `AGENTS.md` §5, `src/vikunja-reuse-policy.test.ts` | Vikunja provenance out | #74 |
| List view | `src/list/ListView.vue` + `ListRow.vue` — secondary view of the same items | Keep as secondary. Do not Trello-restyle it | unchanged / deferred |

## MVP

Package [#73](https://github.com/Kolonie-AI/kolonie-workplace/issues/73)
children, in execution order:

| Issue | What lands |
|---|---|
| #83 | This document. |
| #74 | Strip Vikunja source, NOTICE inventory and reuse permission. |
| #75 | Six fixed lists; Trello board / list chrome; inline add-card composer. List view stays secondary. |
| #76 | Dense card face: cover slot, colour-first labels, zero-suppressed badges; hide face-level Move-to-lane select. |
| #77 | Card-back modal; description column; compact Add-to-card rail; Labels / Dates / Members popovers. |
| #78 | One unnamed checklist section on the card back. |
| #79 | Comments and activity (“Write a comment…”). |
| #80 | Mock attachments and covers. Fixture-only `coverAttachmentId` exclusive with `coverColour`. |
| #81 | Within-list reorder and cross-list move. Lists do not drag. |
| #82 | Filter popover plus empty / loading / a11y. |

Also in MVP: description; labels / members / dates on the card back.

## Deferred

- User-defined lists; list rename / delete / reorder; a seventh Todo column.
- Workspaces; Power-Ups; Automation / Butler; Planner / Inbox / calendar.
- Templates; stickers; custom fields; watch / vote.
- Nested named checklists; checklist copy / generate.
- Real upload storage; Trello API / sync.
- Hermes dispatcher / `kanban.db` / profile lanes.
- Trello-restyling list view; Trello global bar (search / create /
  notifications) as a replacement for the Colony sidebar.
- Activity-window filters, complete-bit filters and collapsing lists with no
  matching cards — unless a later child finds them already cheap.
- Card-face “mark complete” control. Completion is the **Done lane**.

## Add-card state machine

States: **collapsed** → **open** → **collapsed**.

1. Each of the six lists shows a collapsed control at the **bottom**, after
   the card stack. Empty lists still show it. Label: **Add a card**.
2. Activating it (click or keyboard) opens an inline composer **inside that
   list**, still at the bottom. Focus moves to a textarea. Placeholder:
   “Enter a title or paste a link”. Controls: **Add card**, cancel.
3. **Enter** submits a non-empty trimmed title through `TaskGateway.createWorkItem`
   into that list’s lane. The composer stays open and the textarea clears, so
   a second card can be added without reopening. An empty title does not
   submit.
4. **Escape** or cancel closes the composer and returns focus to the
   collapsed control. The title is discarded.
5. Creating writes only through the gateway. There is no local board store.
6. There is no “Add another list” control.

Current Workplace (`LaneComposer.vue`) already does open / close / Enter /
Escape and keeps the composer at the bottom. Gaps for #75: textarea rather
than a single-line input; visible **Add card** + cancel while open; stay
open after a successful submit.

## Open-close state machine

States: **board** → **card back** → **board**.

1. Activating a card face (click or keyboard) opens the card-back **modal**
   over the still-visible board. The opening card remains the selected
   context.
2. The modal has a cover / header, an inline title, a current-list control
   (“in list …” mapping to the six lanes), a compact Add-to-card rail, a
   main column (description, attachments, one unnamed checklist) and a
   separate comments / activity region.
3. **Escape** or the close control dismisses the modal and restores the
   board. Focus returns to the opening card. Selection is unchanged: the
   opening card remains the context.
4. Closing writes nothing by itself. In-flight field edits that already
   reached the gateway stay; uncommitted composer text is discarded.
5. The board behind the modal does not become a second editor. List view
   is not this modal.

Current Workplace uses a stacked `DetailPane` beside the board. #77 replaces
that with the modal. Do not keep both as competing editors.

## Move state machine

Two motions, one write seam.

**Across lists**

1. Drag a card onto another list, or change the current-list control on the
   card back. The destination is one of the six lanes.
2. The write is `TaskGateway.moveItemToLane`. The card leaves its previous
   list and appears in the destination.
3. Moving into `done` is how a card is completed. There is no separate
   complete bit.

**Inside a list**

1. Drag a card above or below a sibling in the same list.
2. The write is `TaskGateway.reorderWorkItem` with that lane and the new
   position.
3. Dropping a card onto its own list without a new position is a no-op.

**Lists**

- Lists do not drag. There is no list-reorder write. A drop that targets
  list chrome rather than a card position is ignored.

Current Workplace already does cross-list drop and a face-level Move-to-lane
select. #76 hides the select from the face (the card-back current-list
control remains). #81 adds within-list reorder and keeps cross-list move.

## Filter state machine

1. **Filter cards** (shortcut `F`) opens a popover. The board stays visible.
2. MVP criteria, combinable: keyword; assignee; label; due (`has` /
   `overdue` / `none`).
3. Applying a criterion filters the cards in place. Empty lists still occupy
   a well. Lists do not collapse.
4. Criteria are encoded in the URL (`src/items/board-filter.ts`) so a
   refresh restores them. Clearing a criterion removes its parameter.
5. Closing the popover (Escape or outside click) leaves the criteria as they
   are. There is no separate “apply” step.
6. A filter that matches nothing is an empty-filter state, not an empty
   board. Existing `isFilterEmpty` copy already says so; #82 keeps that
   distinction.

Activity windows, a complete-bit filter and “Collapse lists with no matching
cards” are deferred.

## What a worker implementing #75 does not need Trello for

From this document alone:

- Six list wells in lane order, horizontally scrolling, empty wells still
  present.
- List heading + count; composer collapsed at the bottom labelled **Add a
  card**.
- Inline composer: textarea, **Add card**, cancel; Enter / Escape as above.
- No seventh list, no list drag, no list-view restyle.
- Writes go through `TaskGateway.createWorkItem`.
- Visual language: pale list well, white elevated cards, board canvas —
  rebuilt, not copied from Trello CSS.
