# Module documentation

One file per module. Template:
[templates/docs/MODULE_DOC.md](../../../templates/docs/MODULE_DOC.md)

**Updated in the SAME change as the behaviour it describes.** Documentation written "later"
describes a system nobody remembers, and guard G5 blocks a commit that changes application code
without touching documentation.

**Every statement traces to code or observed behaviour.** A module document containing a
plausible guess is worse than an absent one, because it will be believed.

Two sections earn their place by experience, and both are usually missing:

- **External sends** — every control that can trigger an outbound message, *especially* one
  whose label does not suggest it sends anything. That is exactly what an automated run fires
  by accident.
- **Known instrumentation gaps** — declared here, not discovered during a test run.
