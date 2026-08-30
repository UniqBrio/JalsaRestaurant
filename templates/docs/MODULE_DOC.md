# Module — `<name>`

**Last confirmed:** DD-MMM-YYYY

> **Every statement here traces to code or observed behaviour.** A module document containing a
> plausible guess is worse than an absent one, because it will be believed.

## Purpose
What this module does, in the language of a user. Two sentences.

## Prerequisites
Concrete conditions for using it: a role, a completed setup step, existing data.

## Entry points
**Every** route and tab state that reaches this module — not just the main one. Deep links,
notification targets, redirects.

| Entry point | Route | Reached from |
|---|---|---|

## Screen states
| State | When | What is shown | What the user can do |
|---|---|---|---|
| Empty | | | *(an empty state must offer the next action)* |
| Loading | | | |
| Error | | | |
| Offline | | | |
| Permission denied | | | |
| Populated | | | |

## Roles
| Role | Can see | Can do |
|---|---|---|

## Actions
| Action | Test id | What happens | Data written | External send |
|---|---|---|---|---|

## Data
**Reads:** **Writes:** **Constraints that matter:**

## External sends
Every outbound message this module can trigger, and what triggers it.

**Name any control whose label does not suggest it sends anything.** That is precisely what an
automated run fires by accident.

| Trigger | Channel | Recipient | Content |
|---|---|---|---|

## Scenarios
| # | Scenario | Steps | Expected |
|---|---|---|---|

Include unhappy paths: what happens when a prerequisite is missing, when the network fails,
when the user lacks permission, when the data is at the edge of its range.

## Known instrumentation gaps
Declared here, not discovered during a test run.

| What cannot be automated | Why | Manual procedure |
|---|---|---|
