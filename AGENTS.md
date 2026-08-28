# AGENTS.md — kolonie-workplace

This file is binding for any agent working in this repository. Read it fully
before your first edit. If it contradicts your general habits, this file wins.

---

## 1. What this repository is

The authenticated human workplace for Kolonie AI: the visual surface over a
citizen's profession, venture, work items, wakeup recommendation and handover.

**This is not the platform.** Canonical work state, HTTP API, events and MCP
actions belong in [`kolonie-platform`](https://github.com/Kolonie-AI/kolonie-platform).
**This is not the public website.** Agents register through MCP, not here.

Read `README.md` in this repository before writing code. It states the product
boundary and the UI-first sequence.

`README.md` and this file agree on the visual and lifecycle references as of
2026-08-28; §5 is the binding statement, and `README.md` states the same
rule in prose.

## 2. Where the work is

Open work is GitHub issues **in this repository**.

```text
https://github.com/Kolonie-AI/kolonie-workplace/issues
```

Do not file workplace implementation issues in `kolonie-docs` or
`kolonie-platform`. Do not add workplace issues to the Colony-wide
[project board](https://github.com/orgs/Kolonie-AI/projects/1). That exclusion
is deliberate while this experiment is evaluated.

Do not record task state in a Markdown file here.

An issue that is ready to implement must be pickup-able by an agent that has
never seen this project:

- Goal — one paragraph, what exists at the end
- Context — why, naming the document that decided it
- Blocked by — issue numbers, if any
- Acceptance criteria — checkable, not aspirational
- Definition of done — the check command, at least one rejection case, and
  the no-secrets rule
- Explicit non-goals

The writing standard is
[`AGENTS.md` in kolonie-docs](https://github.com/Kolonie-AI/kolonie-docs/blob/main/AGENTS.md).

## 3. Rules

- **Application code lands only through an issue that asks for it.** A Vue
  tree, a package manifest or a build config is implementation work and needs
  its issue. The first-cut package
  ([#12](https://github.com/Kolonie-AI/kolonie-workplace/issues/12)) is that
  ask, and its bootstrap issue
  ([#3](https://github.com/Kolonie-AI/kolonie-workplace/issues/3)) is what
  rewrites this bullet — so a worker holding an issue from that package has
  the permission and does not need to ask for it again.
- **Do not create a second source of truth.** Mock data is allowed for the
  UI-first spike. A writable local board, a shadow database, or a
  bidirectional sync with GitHub/Trello is not.
- **Do not overload platform `tasks`.** Academy quests and workday items are
  different domains. Platform schema work belongs in `kolonie-platform`.
- **No secrets, credentials, host names or IP addresses** in any file,
  including tests and comments.
- **Vikunja reuse is forbidden.** Vikunja is a rejected former reference.
  Do not import, copy or adapt its source, CSS, icons or assets. See §5.
- **English** in repository prose, issues, comments and commit messages.

## 4. Integration

**One issue, one branch, one pull request. Never commit to `main`.**

Branch from `main` as `feat/<slug>-<issue>`, `fix/…` or `docs/…`, open a pull
request that references the issue, and let the maintainer merge it. Use the
configured Git identity for this checkout.

This rule replaced *"commit and push to `main`"* on 2026-08-26, and the reason
is worth keeping. That instruction was written while this repository was
documentation only, where it was harmless. The first-cut package
([#12](https://github.com/Kolonie-AI/kolonie-workplace/issues/12)) delivers a
UI as a sequence of small issues whose whole value is that each one is
separately reviewable — and an agent reading the old rule would have pushed
the application bootstrap straight onto `main`, unreviewed, while believing it
was following this file. A binding instruction that quietly stops matching the
work is more dangerous than a missing one.

Confirm with the maintainer before:

- changing repository visibility
- pointing this repository at the Colony-wide project board
- importing a third-party frontend tree
- spending money, or any DNS / live VPS write

## 5. Settled decisions, and what still needs the maintainer

See `kolonie-docs/AGENTS.md` for the global list of things that need a
maintainer; §4 above adds this repository's own.

**Trello is the visual and interaction reference; do not copy Trello source.**
Rebuild behaviour and hierarchy by observation. Do not copy Trello CSS,
assets, logos or proprietary copy. Hermes Kanban supplies lifecycle
semantics only: the six lanes in `src/domain/lanes.ts` stay fixed, and
Workplace must not grow a seventh list. The dated measurement, file matrix
and state machines live in
[`docs/trello-reference.md`](docs/trello-reference.md). Colette's persistent
Trello research account is Vault key `trello/colette-reprise` and nothing
more about that account belongs in git.

**Vikunja reuse is forbidden.** Vikunja is a rejected former reference. A
2026-08-27 permission to copy or adapt its source (#47) was withdrawn on
2026-08-28 (#74). Do not import Vikunja source, CSS, icons or assets. Do
not list Vikunja paths in `NOTICE`. The Colony domain does not come from
an upstream task model. Canonical work state stays in `kolonie-platform`.
`TaskGateway` remains the only seam through which board data reaches a
component.

This repository is AGPL-3.0-or-later because the workplace is a
network-facing Colony application, not because of any third-party frontend.

The decision record is
[`human-workplace-form.md`](https://github.com/Kolonie-AI/kolonie-concept-lab/blob/main/concepts/human-workplace-form.md)
in `kolonie-concept-lab`.
