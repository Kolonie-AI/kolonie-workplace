# 0001 — Vikunja UI extraction

- **Date of investigation:** 2026-08-25
- **Issue:** kolonie-workplace#1
- **Kill question:** Can the useful Vikunja UI survive behind a Colony-owned
  adapter without retaining Vikunja's backend model?
- **Recommendation: No-Go**, with one narrow Conditional Go carve-out for
  interaction patterns, described in "What we did take" below.

Vikunja is AGPL-3.0-or-later. No Vikunja source file was copied into this
repository, so no third-party copyright notice needed to be carried. Had any
file been reused, its header and the project attribution would have been kept
intact, as `AGENTS.md` and `NOTICE` require.

## Method

The Vikunja frontend was read remotely, file by file, through the GitHub
contents API. The repository was deliberately **not** cloned and nothing was
vendored, per the issue's non-goals. Files were selected by walking
`frontend/src` and reading the components that implement the three interactions
the workplace actually needs: a card, a board, and a task detail.

Files read in full or in relevant part, all at
`go-vikunja/vikunja`, path `frontend/src`:

- `components/tasks/partials/KanbanCard.vue`
- `components/tasks/partials/PriorityLabel.vue`
- `components/tasks/partials/SingleTaskInProject.vue`
- `components/project/views/ProjectKanban.vue`
- `views/tasks/TaskDetailView.vue`
- `modelTypes/ITask.ts`
- `models/abstractModel.ts`
- `services/abstractService.ts`
- `package.json`
- directory listings of `models/`, `services/`, `components/tasks/partials/`,
  `components/project/views/`

## Coupling evidence

Every coupling below is a named import in a named file, not an impression.

### 1. The card cannot be lifted without the store, the router and a service

`components/tasks/partials/KanbanCard.vue` — the smallest component that looked
reusable — imports, in one file:

- `useTaskStore` from `@/stores/tasks`, and calls `useTaskStore().update({...})`
  inside `toggleTaskDone`. The card **writes**. The workplace is read-only.
- `useProjectStore` from `@/stores/projects`, indexed as
  `projectStore.projects[props.task.projectId]` — a Vikunja project registry
  the Colony does not have and will not introduce.
- `AttachmentService, {PREVIEW_SIZE}` from `@/services/attachment`, instantiated
  as `new AttachmentService()` and called for a cover-image blob URL. That is a
  live HTTP call to the Vikunja backend from inside a presentational card.
- `useRouter` from `vue-router`, pushing a named route `task.detail` with
  `state.backdropView`. Vikunja's routing shape leaks into the card.
- `getHexColor` from `@/models/task` and `SUPPORTED_IMAGE_SUFFIX` from
  `@/models/attachment` — model-layer imports inside a view component.

The card also reads `window.DEBUG_TASK_POSITION`, a global.

### 2. Even the trivial components reach for the auth store

`components/tasks/partials/PriorityLabel.vue` is 60 lines of template and is
still not free-standing: it imports `useAuthStore` from `@/stores/auth` and
reads `authStore.settings.frontendSettings.minimumPriority`. A label component
depends on a per-user backend setting. It also depends on `$t(...)` from
`vue-i18n`, on `PRIORITIES` from `@/constants/priorities`, and on the global
`Icon` component registration.

The workplace does not have Vikunja's numeric priority ladder — the Colony's
recommendation carries an explicit reason string instead — so the semantics are
wrong even before the wiring is.

### 3. The task model is Vikunja's backend schema, not a workplace domain

`modelTypes/ITask.ts` declares 35 fields. They are Vikunja's API contract:
`bucketId`, `buckets`, `projectId`, `position`, `identifier`, `index`,
`percentDone`, `repeatAfter`, `repeatFromCurrentDate`, `repeatMode`,
`reminders`, `relatedTasks`, `coverImageAttachmentId`, `subscription`,
`reactions`, `isFavorite`, `maxPermission`.

None of these carry the concepts the workplace journey needs: profession,
mission, venture, milestone, operator-needed blocker, smallest unblock,
structured handover (`summary` / `learned` / `resumeWith`), evidence. The
overlap between `ITask` and the workplace `WorkItem` is roughly `id`, `title`
and a done flag. Adopting `ITask` to reuse a card would mean carrying 30 fields
of a foreign backend to gain three.

`models/abstractModel.ts` confirms the direction of the coupling: `assignData`
calls `objectToCamelCase(data)`, i.e. models exist to unwrap the Go API's
snake_case payloads. `services/abstractService.ts` calls `objectToSnakeCase` on
the way out and builds an `AuthenticatedHTTPFactory` over `axios` with fixed
`create/get/getAll/update/delete` paths. The model layer *is* the backend
contract; it is not a domain model that happens to be fetched over HTTP.

### 4. The board and the detail view are integration surfaces, not components

`components/project/views/ProjectKanban.vue` (32 kB) imports five Pinia stores
(`base`, `tasks`, `kanban`, `auth`, `projects`), four services
(`taskPosition`, `projectViews`, `taskBucket`, `savedFilter`), four models,
`zhyswan-vuedraggable`, `PERMISSIONS`, `i18n`, and a `TaskFilterParams` type
from `services/taskCollection`. Its whole purpose is drag-to-reorder, which
writes positions to the backend — a mutation the workplace explicitly excludes.

`views/tasks/TaskDetailView.vue` (38 kB) has 45 imports at lines 655–717,
including six stores, TipTap-backed `Description`, `Attachments`, `Comments`,
`Reactions`, `TaskTimeTracking`, `RelatedTasks`, `Reminders`, `RepeatAfter`,
`BucketSelect` and `Subscription`. Every one of those is a Vikunja feature with
a Vikunja endpoint behind it. The workplace detail needs goal, state, blockers,
handover and evidence — an intersection of approximately zero.

### 5. The dependency and toolchain surface travels with the code

`frontend/package.json` declares `engines.node >= 24.0.0`, `packageManager:
pnpm@11`, and a dependency set including `axios`, `@sentry/vue`, fifteen
`@tiptap/*` packages, `@fortawesome/*`, `@kyvg/vue3-notification`,
`@intlify/unplugin-vue-i18n` and a service worker via `workbox`. Reusing a card
pulls the icon system, the i18n runtime and the notification system with it,
because the templates call `<Icon>`, `$t()` and `success()` directly. It also
pulls Bulma-derived SCSS variables (`$radius`, `$family-sans-serif`) and a CSS
custom-property theme (`--grey-500`, `--danger-text`) that the extracted file
would render unstyled without.

## What we did take

No code. What survived the reading is **interaction shape**, which is not
copyrightable expression and was reimplemented from scratch:

- a state-grouped board (`ready` / `active` / `blocked` / `completed`) rather
  than free-form buckets;
- a card that carries a title plus a small number of at-a-glance flags;
- clicking a card to open a detail pane beside the board rather than navigating
  away.

`src/components/WorkItemGroup.vue` and `src/components/WorkItemDetail.vue` are
original files. They contain no Vikunja markup, class names, SCSS or logic.

## Cost comparison

**Continuing extraction.** To make `KanbanCard.vue` render in this repository
you would have to: stub or replace two Pinia stores; remove the
`AttachmentService` call; remove the `useTaskStore().update` mutation, which is
most of the component's behaviour; supply `vue-router` with a `task.detail`
route; register FontAwesome; install `vue-i18n` and author the message catalogue
keys the templates reference; port the Bulma SCSS variables and the CSS theme;
and either adopt `ITask` or write a mapper from the workplace domain into 35
fields of which 30 would be dead. That is days of work whose output is a card
that shows a title and a due date, plus a permanent AGPL attribution obligation
and a standing incentive to keep drifting toward Vikunja's model — the exact
second-source-of-truth failure `AGENTS.md` forbids.

**Rebuilding the thin surface.** The board, the card, the detail pane, the
recommendation panel and the unavailable state in this spike total roughly 400
lines of Vue across four files, written in one sitting, with no runtime
dependency beyond Vue itself and no imported licence obligation.

The rebuild is cheaper by a wide margin, and the gap grows rather than shrinks:
Vikunja's components are large because they carry Vikunja's feature set, and
the workplace wants almost none of it.

## Verdict

**No-Go on extracting Vikunja frontend code.**

The kill question answers itself in the negative. The useful Vikunja UI does
**not** survive behind a Colony-owned adapter, because the parts that look
reusable are not adapter-shaped: they reach past any adapter directly into
Pinia stores, HTTP services, the router, i18n and a global icon registry, and
they mutate. An adapter can replace a data source; it cannot replace five
ambient singletons that the component imports by name.

Per `README.md`, the fallback applies: the validated journeys stay and the thin
workplace surface is rebuilt. That is what this spike delivers.

**Conditional Go**, narrowly, on *returning to read* Vikunja when the workplace
needs an interaction it has not designed — Gantt scheduling is the plausible
one. Read it for the shape, reimplement the shape. Do not import the file.

## What would reopen this

- The workplace acquiring genuine write semantics and a positional board, at
  which point `calculateItemPosition` in `helpers/` is worth re-reading.
- Vikunja publishing its presentational components as a standalone,
  store-free package. Nothing in the tree read on 2026-08-25 suggests that is
  planned.
