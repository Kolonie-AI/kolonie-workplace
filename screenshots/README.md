# Screenshots for #11 — first-cut visual integration

Captured with Playwright/Chromium against the fixture catalogue, at the two
viewport sizes #11 asks for. Fixture data only: every name in them begins
"Fictional". No credential, host name or address appears in any image.

| File | Viewport | Shows |
|---|---|---|
| `desktop-1440x900.png` | 1440×900 | Kanban, six lanes, detail closed |
| `desktop-1440x900-kanban-detail.png` | 1440×900 | Detail pane open beside the board |
| `desktop-1440x900-list-detail.png` | 1440×900 | List view with the detail pane open |
| `mobile-390x844.png` | 390×844 | Kanban, sidebar stacked above the workspace |
| `mobile-390x844-kanban-detail.png` | 390×844 | Detail pane above the board, close reachable |
| `mobile-390x844-list-detail.png` | 390×844 | List view at the narrow viewport |

This branch carries **only** these artifacts. #11 states that generated
artifacts need not be committed, so they are kept off `main` and parked here
so the issue can link to something viewable.
