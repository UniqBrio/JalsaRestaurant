# Items — the reference screen

> The one route the starter ships (`src/app/page.tsx` → `src/features/items/`). It exists so
> that every spec under `tests/functional/` has something real to drive, and so that a new
> application has a worked example of the patterns composed together, not only in isolation.

## What it composes — and builds none of

| Concern | Uses | Pattern |
|---|---|---|
| Section tabs | `TabRow` | CP-7 · CP-17 |
| Search, filters, sort, count | `ListControls` + `useListControls` | CP-23 |
| Add / edit form | `ItemForm` over `Dialog` | CP-14 · CP-16 · **CP-25** (edit parity) |
| Archive confirmation | `ConfirmDialog`, `tone="destructive"`, labelled **Archive item** | CP-14 · **CP-26** (delete semantics) |
| Outcome messages | `ToastHost` + `useToasts` | CP-11 · CP-28 |
| Data access | `items.api.ts` → the one API client | CP-4 |

## The rules the screen encodes

- **After every write, re-read.** Rows on screen are never edited locally to look like the
  write happened. The archive test reloads the page and expects the row to stay gone; a row
  removed optimistically passes the first assertion and fails the second.
- **The verb matches the model.** The reference schema archives, so the row control and the
  confirmation both say *Archive*. A control that says Delete and archives is a lie the user
  acts on.
- **Edit arrives populated, addressed by database id, and never clears what it did not load.**
  `schedule` is deliberately not rendered by the form; the unchanged-edit spec proves it still
  round-trips because `items.api.update` merges the draft over the whole record.
- **Save hands control back at once.** The dialog closes on submit and focus returns to the
  opener; the outcome is a toast. A failed save brings the dialog back *carrying the draft*.
  Holding the dialog open with Save disabled parked focus on `<body>` for the whole round
  trip — the keyboard journey spec is the rung.
- **Tab order is the visual order**, and it is pinned in `keyboard.functional.spec.ts`:
  tabs → Add → Search. Nothing here reorders with CSS.

## Running it

```bash
npm run dev            # http://localhost:3000 — needs .env (copy .env.example)
npm run test:functional
```

The functional suite boots its own server with test values (see `playwright.config.ts`
`webServer.env`), so it needs no `.env`. In a sandbox that pre-installs a browser and forbids
downloads, set `PW_CHROMIUM_PATH` to it.
