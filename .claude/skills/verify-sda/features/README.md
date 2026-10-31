# SDA verification map

This directory is the maintained source for verifying SDA's user-facing behavior. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- The isolated stack is up: `$V up`, where `V=.claude/skills/verify-sda/scripts/verify-sda.sh`.
- `$V doctor` prints `doctor: healthy`.
- The app is at `http://localhost:3100`. Never use `:3000`, which is the developer's own stack.
- A fresh instance has no runs. Recipes that need an ingested thread say so in their preconditions.

## Driving conventions

- Prefer accessible roles and names, from the table in `SKILL.md`, over CSS or DOM position.
- Treat thread IDs and copy as literal. The UI uses curly quotes and the ellipsis character `…`.
- Wait for text or a run status, not a fixed sleep. Use `$V wait-run <thread-id>` for ingestion.
- Running pages refresh every 2 seconds. Aborted `?_rsc=` requests in the network log are normal.

## Proof and skip reporting

- Make one evidence folder per feature: `D=$($V evidence-dir <feature-id>)`.
- UI proof is a screenshot of the action's result and of the settled end state, with the page heading visible.
- Stored-state proof is `$V db <thread-id> "$D"` taken after the end state settles.
- Name the feature ID and entry point in each screenshot's file name.
- Report an unreachable path with the command tried and the precondition that wasn't met.
- Don't report an entry point as verified through a different one.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph on the user-visible behavior, then four H2 sections in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-sda and the T3 browser`, and `Gotchas`.

## Features

- [Start a run](./start-run.md) covers the home page input, validation, the redirect into a live run, and the recent-runs list.
- [Thread results](./thread-results.md) covers the comment totals, the counting explainer, the ranked skill table, and the highlighted excerpts with HN links.
- [Failed run](./failed-run.md) covers the failed banner, the error text, the no-data copy, and the failed row on the home page.
- [Not analysed](./not-analysed.md) covers a thread with no runs, its start button, and invalid thread IDs.
