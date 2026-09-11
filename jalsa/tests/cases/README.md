# Test-case registry

The registry lives here — a spreadsheet, a markdown table, whatever your team will **actually
maintain**. Format matters far less than the lifecycle.

Case format: [templates/tests/TEST_CASE.md](../../../templates/tests/TEST_CASE.md)
Reasoning: [docs/15-TEST-CASE-GENERATION.md](../../../docs/15-TEST-CASE-GENERATION.md)

## The lifecycle

| Verb | When | Rule |
|---|---|---|
| **ADD** | A change adds behaviour | New sequential ID + today's date |
| **UPDATE** | A change modifies an existing flow | Edit in place, refresh the date. Never leave a case describing a flow that no longer exists. |
| **RETIRE** | The feature is removed from the product | Only then. List the ID and the reason. **IDs are never reused.** |

Every test run ends with an explicit delta — `added … ; updated … ; retired …` — and then
**verifies it against the file**. A claimed delta the file does not reflect is a failed run
regardless of the test results.

Suggested id format: `<PREFIX>-<MODULE>-<NNN>`, e.g. `APP-INV-041`.
