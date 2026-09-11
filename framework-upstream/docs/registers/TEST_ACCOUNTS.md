# Test Accounts and Data Policy

> **The standing answer to every credential prompt during testing.**
>
> Its purpose is to stop a test run pausing to ask a human a question this file already answers —
> and, more importantly, to make the *unsafe* answers impossible to reach by accident.

---

## Accounts

| Account | Role | Environments | Notes |
|---|---|---|---|
| _test-owner@example.test_ | owner | development, test | |
| _test-member@example.test_ | member | development, test | |

**These grant nothing in production.**

---

## Rules

1. **Contact details in test data are always fake.** Never a real phone number or email — not
   the developer's own, and not a test account's, used as a *customer* record.
2. **Outbound sends** go only to the pre-approved destinations listed below. **Anything else
   stops and asks.** Never a customer's real address, under any circumstance.
3. **Never delete the test tenant.** Deletion flows are exercised up to the final confirmation
   and never through it — otherwise every subsequent test run starts by rebuilding the world.
4. **Data inserted for a test is inserted → verified → deleted.** Zero orphans. A suite must be
   able to run twice.
5. **Persistent settings are flipped and restored**, never left flipped. The next run's baseline
   is the previous run's cleanup.
6. **A database-level failure during a test run:** stop → describe → propose the migration →
   **wait for approval**. Never repair production interactively.

## Pre-approved outbound destinations

| Channel | Destination | Notes |
|---|---|---|
| _email_ | _test-inbox@example.test_ | |
| _SMS / chat_ | _(none by default)_ | Add deliberately, per environment |
