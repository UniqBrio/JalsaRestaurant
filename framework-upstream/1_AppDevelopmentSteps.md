# How to build an app with this framework

Plain-English steps. Follow them in order.

Everything here is the short version. When you want the detail and the reasons,
[docs/02-PROJECT-INITIALIZATION.md](docs/02-PROJECT-INITIALIZATION.md) is the long version of
Part 1, and [docs/01-SDLC.md](docs/01-SDLC.md) is the long version of Part 2.

**Two folders, and it matters which one you are in.**

- The **framework** folder is this one. It holds the process and the tools.
- The **app** folder is the one you are about to create, somewhere beside it.

Most commands run in the app. A few run in the framework. Each step below says which.

---

## Part 1 — Setting up a new app (once)

### Step 1. Write three sentences first

In the framework folder, or on paper, answer:

- What does this app do?
- Who is it for?
- What does "working" mean?

If you cannot write those three sentences, the requirements are not ready. Scaffolding now will
not help — you will just build the wrong thing faster.

### Step 2. Answer one question before you build anything

**Will people install this on their phone, or will you put it in the app stores?**

That single question decides how the app is built, and changing your mind later is expensive.

| Your answer | What you need |
|---|---|
| "It just needs to work in a phone browser" | The normal setup. Carry on to Step 3. |
| "It should be installable, or go to the App Store / Play Store — now or later" | A **different** kind of app, which this framework cannot build yet. See below. |
| "It's mainly a public website that needs to show up in Google" | The normal setup. Carry on to Step 3. |
| "Both — a public website **and** an installable app" | Talk it through first; you may need two things, not one. |

**If you need the installable/app-store kind**, stop here. The framework doesn't have the pieces
for it yet, and it will tell you so rather than quietly giving you the wrong thing. That's a
conversation to have before anyone writes code, not a setting to flip afterwards.

Not sure? That's fine — it's the one question worth asking someone before you start.

### Step 3. Create the app

**In the framework folder:**

```bash
node scripts/new-app.mjs --name my-app --dir ../my-app
```

This copies the starter code and links the process. "Linked" means your app points at this
framework folder rather than owning a copy — so when the framework improves, your app can pick
it up without you copying files around.

It will finish by telling you what kind of app it just made. If that doesn't match what you
answered in Step 2, stop and ask — don't carry on and hope.

### Step 4. Install and make the first commit

**In the app folder:**

```bash
cd ../my-app
npm install
git init
git add -A
git commit -m "Scaffold"
```

Commit the `package-lock.json` that `npm install` creates. **Your app pins its versions.** (The
framework's starter deliberately does not — that is its job, not yours.)

### Step 5. Set your colours before you build any screens

**In the app folder**, edit `design/tokens.json`, then:

```bash
npm run theme:build
```

All colour lives in that one file. Never type a colour code anywhere else. Doing it now takes a
minute; doing it after you have thirty screens takes a week.

### Step 6. Add your logo and images, for both light and dark

Put them where `design/tokens.json` says. You need both versions. A logo that only works on a
white background is a bug you will find later, from a user.

### Step 7. Create your registers, and write down your environments

A new app has no `docs/registers/` folder yet. Copy the blank ones across —
**from the framework folder:**

```bash
cp -r docs/registers ../my-app/docs/registers
```

These are running notes: decisions you made, bugs you root-caused, limits you hit. They are
worth almost nothing today and a great deal in six months — but only if you write in them as
things happen. You cannot backfill them later.

Then fill in `docs/registers/ENVIRONMENTS.md` first: which database is which, who can write to
it, and which one must **never** be touched by automation.

That one file prevents the worst question in software: *"which database did that test just
write to?"*

### Step 8. Check the safety checks are switched on

There is nothing to install. The scaffolder already put `.claude/settings.json` in your app, and
that file switches the guards on for every Claude Code session automatically.

Just make sure it is committed:

```bash
git ls-files .claude/settings.json
```

If that prints the filename, you are done. If it prints nothing, commit it. Settings that live
on only one machine protect only one machine.

### Step 9. Fill in your app's rules

The scaffolder already created `CLAUDE.md` in your app. Fill in the rules that are specific to
**your** app: how login works, how data is fetched, what must never happen.

For each rule, write down where in the code it is enforced. A rule with no file next to it
cannot be checked, so it will quietly stop being true.

### Step 10. Ship something trivial, all the way

Before building anything real, push one tiny thing through the whole process — plan, build,
test, deploy, check it works.

You will find about three broken things. Finding them now, on something that does not matter, is
the cheapest debugging you will ever do.

---

## Part 2 — Building features (every time)

This is the loop you will repeat for the rest of the project.

### Step 1. Say what you want, in your own words

**In the app folder**, in Claude Code:

```
/request
```

Then describe what you want in plain words. You do not need to know whether it is a feature, a
bug, or a change.

`/request` works out which it is, writes it down properly in `requests/`, and then continues
into the right process automatically — in the same session. You do not run a second command.

**If somebody already designed it** — you have a folder of design pages, a prototype, screens
someone approved — say so and point at the folder. The framework reads that folder *first* and
writes down what it found: every screen, every menu, the brand colour, and which files it could
not read. Then it builds *that* design. A menu or a screen from the approved design cannot
quietly disappear: the final check refuses to pass until each one is shown in the code, or
someone with authority has written down why it was dropped. And if your brief and the design
disagree — you said twelve menus, the design shows thirteen — it stops and asks which is right,
rather than picking one for you.

### Step 2. Answer the questions it asks

It will stop and ask you things. Answer them. Anything you do not answer is recorded as
`unknown` rather than guessed at — that is deliberate, so nobody later mistakes a guess for
something you decided.

### Step 3. Let it build

It plans, builds, and tests. It will stop at checkpoints for your approval.

### Step 4. Check it before merging

**In the app folder:**

```bash
npm run gate
```

There are three possible answers:

| Result | Meaning |
|---|---|
| **PASS** | Safe to merge |
| **FAIL** | Something is broken. Fix it |
| **BLOCKED** | A check could not run. **This is not a pass.** Find out why |

Do not merge on anything but PASS.

### Step 5. Merge

---

## Part 3 — Keeping up with framework improvements

The framework gets better over time. Your app does not get those improvements automatically —
and that is on purpose, so nothing changes under you mid-task.

**When you want the latest**, first update the framework:

```bash
cd ../Custom-Web-App-Development-Framework
git pull
```

Then, **in the app folder**:

```bash
npm run framework:upgrade
```

It tells you what changed and what, if anything, you need to do. If you are already up to date
it says *"Already current. Nothing to do."* and stops — so running it twice costs nothing.

**Do this between tasks, never in the middle of one.** Pulling new rules into a job already in
progress is how a working app goes red halfway through.

This one is now enforced rather than trusted: if a run is open, `framework:upgrade` refuses and
names the run you are in the middle of. It was measured — a half-hour tooltip was about 90
seconds of checks, roughly 15 minutes of an upgrade taken mid-task, and roughly 10 minutes of
cleaning up problems the new checks found that had nothing to do with the tooltip. The person
waiting for the tooltip waited for all of it.

If a feature genuinely cannot ship without the upgrade, add `--during-run`.

To just check where you stand:

```bash
npm run framework:status
```

---

## Part 4 — When you hit something you're not fixing today

Not every problem should be fixed in the run that finds it. Fixing everything you notice is how
a one-line change turns into a half-day — the requester waited, and nobody decided that was
worth it.

But a problem nobody wrote down is not a decision. It is a surprise on a delay fuse.

**Write it in `docs/registers/TECH_DEBT.md`.** One row:

| Column | What goes in it |
|---|---|
| **ID** | `TD-003`, `TD-004`… next number, never reuse one |
| **What** | The problem, plainly |
| **Why accepted** | Why you are not fixing it now |
| **What it costs** | Who this slows down, and how — the ongoing price |
| **Paid down when** | The condition that makes it worth fixing |
| **Added** | The date |

The **"what it costs"** column is the one that matters. It is what makes the cost arguable, and
arguable is the only way anything ever gets prioritised over the next feature. A row without it
is a wish.

### What belongs here

- The framework upgrade you're putting off
- A test harness you rebuilt because reusing one was too fiddly
- A workaround you took knowingly
- A slow step you're living with

### What does not

- **A lesson that might apply to other apps** → that is Part 5, `npm run capture`
- **Something actually broken now** → that is a bug, run `/request`
- **A thing you'll do in the next ten minutes** → just do it

### Acting on the queue

There is no scheduler and no cron job. Someone reads the file and decides. When you want to
clear it:

```
/triage
```

That takes the list, removes duplicates, orders it, scores it, and stops at a gate so you choose
what actually gets done. Do this when the list is long enough to argue about — not every run.

**One rule that makes the queue work:** clearing debt is its **own** run. Do not clear a row
because you happen to have the file open during a feature. That is exactly how the half-hour
tooltip happened.

---

## Part 5 — When you learn something worth keeping

Sometimes you fix a bug and realise the lesson is bigger than your app. Write it down straight
away, or it will be forgotten by next week and you will pay for it twice.

**In the framework folder:**

```bash
npm run capture -- --rule "A derived value must recompute when any input changes" --app my-app --apply
```

Two rules for writing the rule down:

1. **No business words.** "Invoice totals must recompute" is about your app. "A derived value
   must recompute when any input changes" is about software. Only the second kind is worth
   keeping. The tool checks this and will refuse the first kind.
2. **One sighting is not proof.** It gets parked, and the framework does **not** change.

If a *different* app later hits the same thing:

```bash
npm run capture -- --sighting-of CAND-002 --app other-app --apply
```

Now it has happened twice, in two different apps, so it is probably a real rule. The tool marks
it ready and tells you to run `/promote` and then `/framework-update`.

**The tool never changes the framework itself.** That step stays with a person, on purpose. A
rule added automatically comes with no test behind it, and a rule nothing tests is just a
comment.

---

## Commands you will actually use

**In the app folder:**

| Command | What it does |
|---|---|
| `npm run dev` | Run the app while you work |
| `npm run gate` | The full check. Run before merging |
| `npm run typecheck` | Just the type errors |
| `npm run lint` | Just the code style |
| `npm run test:unit` | Fast tests |
| `npm run test:functional` | Browser tests |
| `npm run theme:build` | Rebuild colours after editing tokens |
| `npm run framework:upgrade` | Pick up framework improvements |
| `npm run framework:status` | Which framework version am I on? |

**In the framework folder:**

| Command | What it does |
|---|---|
| `npm run capture -- --list` | Show parked lessons |
| `npm run gate` | Check the framework itself |
| `npm run guard:test` | Prove every safety check still works |

**In Claude Code, inside the app:**

| Command | When |
|---|---|
| `/request` | **Start here every time.** It picks the right process for you |
| `/gate` | Run the checks and get an honest verdict |
| `/promote` | A lesson looks bigger than this app |
| `/brainstorm` | Thinking out loud. No code, no changes |
| `/triage` | Work through a list — including the tech-debt queue — and decide what gets done |

You almost never need the others directly — `/request` routes you.

---

## Things that go wrong, and how to avoid them

**Typing a colour code into a component.** Use the tokens. One file, one place, and a rebrand
takes a minute instead of a month.

**Treating BLOCKED as PASS.** BLOCKED means nobody checked. "Nothing found" and "nothing looked"
look identical from a distance, and only one of them is good news.

**Upgrading the framework mid-task.** Finish what you are doing first.

**Skipping Step 10.** Everyone wants to skip the trivial end-to-end run. It is the cheapest hour
in the project.

**Fixing the same bug twice in two apps.** That is what Part 5 exists for. Thirty seconds now,
or the whole bug again in three months.

**Fixing everything you notice along the way.** This is the one that quietly costs the most. A
half-hour "tooltip" was measured at roughly 90 seconds of checks, 15 minutes of a framework
upgrade taken mid-task, and 10 minutes of cleaning up what that upgrade surfaced. Write the
extras in `TECH_DEBT.md` and keep going.

**Leaving the debt row's cost blank.** "We should fix this sometime" never wins an argument
against a feature. "This costs us twenty minutes every release" does.

---

## If you only remember seven things

1. Before a NEW app: will people install it, or is a phone browser enough? Ask first.
2. `/request` for anything you want built.
3. `npm run gate` before you merge. PASS or stop.
4. Colours live in `design/tokens.json`. Nowhere else.
5. `npm run framework:upgrade` between tasks, never during one.
6. Anything you are not fixing today goes in `TECH_DEBT.md`, with what it costs.
7. `npm run capture` the moment you learn something worth keeping.
