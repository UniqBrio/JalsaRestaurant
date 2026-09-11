# Environments

> Ambiguity here produces "which database did that just write to?" — a question with no good
> answers, usually asked after the fact.

| Name | Purpose | URL | Datastore identifier | Who may write | Automated target? |
|---|---|---|---|---|---|
| **development** | Local | `localhost:3000` | local / dev instance | anyone | yes |
| **test** | Automated tests | | | CI + developers | **yes — the only automated target** |
| **staging** | Pre-production verification | | | deploys only | no |
| **production** | Real users | | | **approved deploys only** | **NEVER** |

---

## Binding rules

1. **Production is never an automated test target.** Not "usually not". Never.
2. **A staging deploy is a production BUILD pointed at NON-PRODUCTION DATA.** Those are separate
   questions and conflating them is how a test run reaches live customers.
3. **Every schema change reaches production only through a migration file** that was applied to
   the test environment first and confirmed. Direct edits to either environment are drift by
   definition — and "minor" is not an exemption.
4. **Schema parity is checked before backend work and again before production promotion.** Any
   unacknowledged difference blocks.
5. **Outbound messages are deny-by-default outside production**, with an explicit allowlist.

## Configuration per environment

| Variable | development | test | staging | production |
|---|---|---|---|---|
| `APP_ENV` | development | test | staging | production |
| `ALLOW_OUTBOUND_MESSAGES` | false | false | false | true |
| `PUBLIC_BUILD_ID` | *(empty)* | commit SHA | commit SHA | commit SHA |
