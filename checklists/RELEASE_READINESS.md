# Release Readiness

> Every item is blocking unless explicitly waived in writing, by someone who can be asked why.

## The gate
- [ ] Verdict is **PASS**.
- [ ] Any **BLOCKED** class is named, and its specific IDs are accepted in writing for this
      release. *BLOCKED is never a pass.*
- [ ] Not-run counts stated per module. No not-run geometry case in a touched module.
- [ ] The registry delta is verified **against the file**, not merely claimed.

## Database
- [ ] **Schema parity between environments is clean**, or every difference is explicitly
      acknowledged. *"It worked in staging" means nothing while a parity diff is open.*
- [ ] Every object this release touches exists in a migration file.
- [ ] Migrations are ordered, idempotent, and each rollback is written.
- [ ] Destructive changes are split expand → migrate → contract, across releases.
- [ ] Every migration was applied to the non-production environment first, and confirmed.

## Configuration
- [ ] Every required variable exists in the target environment. *A missing one is an outage at
      boot.*
- [ ] Secrets are in the platform store, not the repository.
- [ ] Feature flags are set deliberately for this environment.
- [ ] Outbound sending is configured correctly — and is off, or allowlisted, everywhere it should be.

## Rollback
- [ ] Written, specific, and **previously executed at least once**.
- [ ] Irreversible steps identified and called out — a destructive migration, a sent message, an
      external side effect.
- [ ] The person who will execute it knows they will.

## Communication
- [ ] Changelog written in the language of the user.
- [ ] Support knows what changed and what to say.
- [ ] Documentation reflects the new behaviour.
- [ ] Anyone who must act (an operator, a customer) has been told before the deploy, not after.

## After
- [ ] Someone is watching for the next hour, and **knows what they are watching for**.
- [ ] +1h and +24h checks scheduled.
- [ ] Alerts exist for the things that fail **silently**: a scheduled job that stopped, a queue
      that stopped draining, sends that stopped sending. *Alert on absence, not just on failure.*
