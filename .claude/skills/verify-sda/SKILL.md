---
name: verify-sda
description: "Drive the SDA web app (HN 'Who is hiring?' skills demand, Next.js on :3100 in an isolated docker compose stack with Postgres, Temporal and the ingestion worker) the way a user does, and capture screenshots plus the matching ingestion_runs and skill_mentions rows as proof. Use to prove a UI, ingestion or extraction change works, to reproduce a bug, or before claiming any user-visible behavior in this repo."
---

# Verify SDA

SDA has one user surface: a Next.js web app. A user pastes a Hacker News "Who is hiring?" thread ID or link on the home page, a Temporal workflow ingests the thread into Postgres, and the thread page shows skill counts with source excerpts. Everything runs in Docker.

This skill runs its own copy of the stack as Compose project `sda-verify`, with the web app on `http://localhost:3100` and Temporal UI on `http://localhost:8333`. Postgres and Temporal publish no host ports. The developer's own stack is Compose project `sda` on `:3000`. Never drive it, restart it, or read its data as proof, because it holds their working state.

All commands run from the repo root. The helper is `.claude/skills/verify-sda/scripts/verify-sda.sh`, written `$V` below:

```sh
V=.claude/skills/verify-sda/scripts/verify-sda.sh
```

## Launch

```sh
$V up
```

This builds the app image, starts `sda-verify` with fresh volumes, and returns once `GET http://localhost:3100/` serves the page titled `HN skills demand`. That takes 1–3 minutes on a cold start. It refuses to start when `sda-verify` is already running or when something else holds port 3100. A fresh instance has no runs, so the home page shows `No runs yet.`

Source is bind-mounted, so the instance runs the working tree, including uncommitted changes. Edits hot-reload in `web` and `worker`. After a dependency change, run `$V down` then `$V up`.

## Doctor

```sh
$V doctor
```

This is read-only. It checks that postgres, temporal, worker and web are running in `sda-verify`, that the migrate job exited 0, that port 3100 is published by this project's web service, that the page answers with the SDA title, that the `skills` schema exists, that the worker reached `RUNNING`, and that the worker can reach the HN API. It prints the git revision being served and the number of runs in this instance, and exits 1 on any failed check. Run it before driving and whenever something looks off. Don't drive a failing instance; fix it or run `$V down` and `$V up`.

## Drive

Drive the browser with the T3 preview tools (`mcp__t3-code__preview_open`, `preview_navigate`, `preview_type`, `preview_click`, `preview_wait_for`, `preview_snapshot`, `preview_evaluate`). Load them with ToolSearch if they are deferred. Chrome DevTools MCP works the same way if T3 is absent. Use Playwright-style locators built from accessible roles and names. They are stable here:

| Handle | Locator |
|---|---|
| Thread input | `role=textbox[name='HN thread ID or link']` |
| Start a run (home, not-analysed page) | `role=button[name='Analyse thread']` |
| Re-run (thread page) | `role=button[name='Run again']` |
| Input error | `role=alert` containing `Use a numeric HN item ID` or `Enter an HN thread ID or link.` |
| Running banner | `role=status`, text `Fetching thread…` or `Processing comments: N of M` |
| Failed banner | `role=alert`, text `The last run failed` |
| Recent run row | `role=link` whose name contains the thread title or `HN item <id>` |
| Skill row | `role=link[name=/<Skill label>/]`, href `/threads/<id>?skill=<key>`, `aria-expanded` true when open |
| Excerpt highlight | `mark` elements inside the open row |

Routes: `/` is the home page. `/threads/<id>` is the thread page. `/threads/<id>?skill=<key>` opens one skill's excerpts. Skill keys come from `src/lib/skills.ts`, for example `python`, `react`, `typescript`.

Known threads:

- `49922569`, "Ask HN: Who is hiring? (October 2026)", ingests successfully in about 45–100 s. On 2026-10-31 it gave 319 top-level comments, 234 eligible postings, 27 discussion and 58 excluded. HN is live, so take the numbers from `$V db`, not from this file.
- `1` is a story by `pg` and fails fast and deterministically with `HN item 1 is not a hiring thread: posted by pg, not whoishiring`.
- `123` and any other never-run ID shows the not-analysed state.

Useful waits: `$V wait-run <thread-id>` blocks until the thread's latest run leaves `running`, then prints `completed` or `failed`. In the browser, `preview_wait_for` with `text: "Last run completed"` waits for the page to finish auto-refreshing.

For a page that has its own URL and needs no clicks, `$V screenshot <path> <png>` takes a headless Chrome screenshot of `http://localhost:3100<path>` with streamed content loaded. Use it when no browser tool is available, or for a second view.

## Evidence

```sh
D=$($V evidence-dir <feature-id>)
$V db <thread-id> "$D"
```

`evidence-dir` creates `.verify-evidence/<UTC timestamp>-<feature-id>/` at the repo root. The folder is gitignored and survives cleanup. `db` writes these files for one thread:

- `ingestion_runs.txt`: every run, with status, comment progress, error and timestamps.
- `comments_by_eligibility.txt`: posting, not_posting and excluded counts.
- `skill_mentions_summary.txt`: per skill and class, the mention count and the count of distinct postings.
- `skill_mentions.txt`: every mention row with comment ID, author, class, extraction version and excerpt.

Save browser evidence into the same folder. Capture the state before the action, the action's immediate result, and the settled end state:

- **Screenshots.** For any state with its own URL (every thread page state, the home page list), use `$V screenshot <path> "$D/<name>.png"`. With T3 you can also call `preview_snapshot` with `save: true` and copy the returned `screenshotPath` into `$D`.
- **Page text.** For states that exist only after an interaction, such as an inline form error or the same tab updating without a reload, record `preview_evaluate` output as `$D/<name>.json`. Include `location.href`, a timestamp, the relevant text, and `performance.getEntriesByType('navigation').length` when proving that no reload happened.

`preview_snapshot` in a hidden T3 tab often times out after the first interaction ("snapshot timed out after 15000ms"), while clicks, typing and `preview_evaluate` keep working. Don't retry it in a loop. Switch to `$V screenshot` plus page-text JSON. With more than one tab open, pass `tabId` on every preview call.

Proof standards:

- Use the real user path: type into the input and press the button. Don't call `startIngestion`, run `pnpm ingest`, or insert rows to fake a run.
- Pair each screen with stored state. A count on screen must match `skill_mentions_summary.txt` or `comments_by_eligibility.txt`. A status badge must match `ingestion_runs.txt`.
- Ingestion calls the live HN API on purpose, since nothing in production isolates it. Don't mock it. If doctor's HN check fails, report verification as blocked.
- Report every mapped entry point you didn't drive as skipped, with the reason. Driving one entry point doesn't verify the others.

## Cleanup

```sh
$V down
```

This removes only the `sda-verify` containers, network and volumes, including its Postgres and Temporal data. It leaves `.verify-evidence/` and the developer's `sda` stack alone. Close any browser tab you opened (`mcp__t3-code__t3_preview_close`). Run cleanup after failed attempts too. Confirm the evidence folder still lists its files afterwards.

## Feature map

[`features/README.md`](features/README.md) indexes the user-facing features and their recipes. Read it before driving, and update it when the UI changes.
