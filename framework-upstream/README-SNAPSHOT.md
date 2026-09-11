# framework-upstream — a READ-ONLY snapshot, not a second framework

This directory is a verbatim copy of
[UniqBrio/custom-web-app-development-framework](https://github.com/UniqBrio/custom-web-app-development-framework)
at **v1.35.0**, commit `4cdc7b4` (11-Sep-2026), taken so the post-generation review could be run
against the current canonical runbooks rather than against this repository's older copy.

**Nothing here is maintained, executed, or authoritative.** It is evidence of what upstream said
on the day it was read. Do not edit it, do not import from it, and do not fix a bug in it — fix
the bug upstream.

## Why it exists at all

This repository IS the framework, and it had drifted: it carries **v1.29.0** while upstream is at
**v1.35.0**. Six MINOR versions is far enough that a review reading only the local copy would be
reviewing rules that have already been superseded, and would then "discover" lessons upstream had
already learned. Reading both is how that was avoided.

## The version gap is the real finding

| | Version |
|---|---|
| This repository (`../VERSION`) | 1.30.0 — was 1.29.0 before this review's own close-out |
| Upstream, as of 11-Sep-2026 | 1.35.0 |

The rules this review added land on **1.29.0's lineage**. They must be ported onto 1.35.0 before
they can reach any other application, because `scripts/upgrade.mjs` reads upstream's `UPGRADES.md`
and will never see an entry that only exists here. That port is a human decision — it needs
someone to confirm that v1.30–1.35 did not already solve the same three causes — and it is the
first item in this review's "pending on your end".

## Refreshing it

```bash
git clone --depth 1 https://github.com/UniqBrio/custom-web-app-development-framework /tmp/cwadf
rm -rf framework-upstream && mkdir framework-upstream
(cd /tmp/cwadf && tar --exclude=.git -cf - .) | tar -xf - -C framework-upstream
```

Then update the version and commit above, and re-read this file's claims against what arrived.
