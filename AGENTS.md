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
boundary, the UI-first sequence, and the Vikunja extraction kill question.

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

- **No application code until an issue asks for it.** This bootstrap is
  documentation and process. A Vue tree, a Vikunja import or a package
  manifest is implementation work.
- **Do not create a second source of truth.** Mock data is allowed for the
  UI-first spike. A writable local board, a shadow database, or a
  bidirectional sync with GitHub/Trello is not.
- **Do not overload platform `tasks`.** Academy quests and workday items are
  different domains. Platform schema work belongs in `kolonie-platform`.
- **No secrets, credentials, host names or IP addresses** in any file,
  including tests and comments.
- **Preserve licence and attribution** on any imported third-party frontend.
  Vikunja is AGPL-3.0-or-later; keep copyright notices intact.
- **English** in repository prose, issues, comments and commit messages.

## 4. Integration

Commit and push to `main` unless a later `AGENTS.md` revision says otherwise.
Use the configured Git identity for this checkout.

Confirm with the maintainer before:

- changing repository visibility
- pointing this repository at the Colony-wide project board
- importing a third-party frontend tree
- spending money, or any DNS / live VPS write

## 5. Confirm with the maintainer before

See `kolonie-docs/AGENTS.md` for the global list. For this repository
specifically, also confirm before treating the Vikunja extraction as decided:
the first spike still has to answer the kill question in `README.md`.
