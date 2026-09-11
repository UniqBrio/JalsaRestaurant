# requests/ — the intake ledger

Filled request files written by [workflows/request.md](../workflows/request.md) (`/request`),
one per ask, named `<yyyy-mm-dd>-<short-slug>.md`.

## Why these are files and not chat messages

A request that lives only in a conversation cannot be pointed at later. The file is what makes
three things possible:

1. **Binding fields.** The track reads stated fields as decisions and `unknown` fields as
   questions. Neither survives a paraphrase.
2. **Correction rounds.** Round N of a correction names round N−1's file. "What did the last
   fix miss?" is only answerable if the last fix's request still exists, verbatim.
3. **Process evidence.** When a build misses something the request stated, that is a track
   failure; when it misses something the request never contained, that is an intake failure.
   Without the file, every gap is unattributable and nothing improves.

## Lifecycle

- **Committed**, like any other artifact — a request file is the "why" of the diff that closed it.
- **Append-only in spirit:** a filled request is a record of what was asked. Correcting the
  ask means a new file (the next round), not editing history. The one legitimate edit is a
  FIELDS correction at the consuming track's **first gate** — before any work has proceeded —
  which is applied to the file so the file and the work never tell different stories.
- Superseded requests stay. Delete nothing.
