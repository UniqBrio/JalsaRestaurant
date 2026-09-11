# Test case template

> A test case is not "what a human might do". It is an instruction precise enough that a
> **machine** can execute it without asking a question.

| Field | Value |
|---|---|
| **ID** | `<PREFIX>-<MODULE>-<NNN>` — sequential, never reused |
| **Module** | |
| **Title** | What is being verified, not what is being clicked |
| **Priority** | P0 smoke · P1 · P2 · P3 |
| **Type** | functional · responsive · performance · security · accessibility |
| **Automation** | Auto · Manual *(a computable property may not be Manual)* |
| **Preconditions** | The exact state. "Logged in as owner, 3 records, one overdue." |
| **Test data** | The exact values. A runner cannot generate "some data". |
| **Entry point** | The exact route or control. Not "go to settings". |
| **Element** | The test id. Not "the save button". |
| **Steps** | One action per step. One verb each. |
| **Expected UI** | What is visible afterwards. |
| **Expected data change** | **What changed in the datastore.** |
| **Expected external send** | Any outbound message — or explicitly "none". |
| **Negative** | What must NOT happen. |
| **Cleanup** | So the suite can run twice. |
| **Execution status** | Not run · Pass · Fail · Blocked · Skip-known-limitation |
| **Date** | Refreshed on every add or update |

---

## The three fields usually missing, and what each costs

**Expected data change** — without it the case asserts a toast. A success message is what the
application *claims* happened. Several classic data-loss bugs are the application cheerfully
reporting a save that never landed.

**Expected external send** — undeclared, an automated run fires a real message to a real person.

**Cleanup** — without it the suite passes once and fails every subsequent run, and everyone
learns to ignore it.

## Coverage shape per feature
happy path · empty · loading · error · prerequisite-missing · role-specific · unhappy path.
A single happy-path case is coverage of one fifth of a five-state screen, reported as done.
