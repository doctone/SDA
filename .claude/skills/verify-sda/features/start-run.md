# Start a run

A user pastes a "Who is hiring?" thread ID or HN link on the home page and presses `Analyse thread`. The app starts ingestion and lands them on the thread page, which shows live progress until the run completes. The home page lists the latest run for each thread.

## Sub-features

- `start-id` starts a run from a bare numeric ID.
- `start-url` starts a run from a `https://news.ycombinator.com/item?id=<id>` link.
- `start-empty` shows `Enter an HN thread ID or link.` for blank input.
- `start-invalid` shows `Use a numeric HN item ID or a news.ycombinator.com/item?id=… link.` for other text or non-HN links, and keeps the typed value.
- `start-live` redirects to `/threads/<id>` with the running banner already showing, and the progress updates without a reload.
- `start-complete` replaces the banner with `Last run completed … · N comments processed` once the run finishes.
- `start-recent` lists the run on `/` with its title, ID, start time, `N of M comments` and a status badge.
- `start-duplicate` starting a thread that is already running goes to its page without creating a second run.

## How to get to it (user POV)

- Home page `/`: type into `HN thread ID or link` and press `Analyse thread`.
- Thread page of an analysed thread: press `Run again`.
- Thread page of a never-run thread: press `Analyse thread` (see [Not analysed](./not-analysed.md)).

## Driving it with verify-sda and the T3 browser

Preconditions:

- Baseline from the README. For `start-recent` on a fresh instance, the list starts as `No runs yet.`

- **Before.** Open the home page. `preview_open` with `url: "localhost:3100"`. The heading reads `Skills demand from HN hiring threads`. Run `$V screenshot / "$D/start-before.png"`.
- **Invalid input.** Type `who is hiring` and submit. `preview_type` into `role=textbox[name='HN thread ID or link']`, then `preview_click` on `role=button[name='Analyse thread']`. `preview_wait_for` text `Use a numeric HN item ID`. The URL stays `/`, the input keeps `who is hiring` and has `aria-invalid="true"`. Save the `preview_evaluate` result as `start-invalid.json`.
- **Empty input.** Clear the box and submit. The alert reads `Enter an HN thread ID or link.`
- **Start by ID.** Type `49922569` with `clear: true` and press `Analyse thread`. `preview_wait_for` with `urlIncludes: "/threads/49922569"`, then locator `role=status`. Save `preview_evaluate` of `location.href` and the `[role=status]` text as `start-id-live.json`, then run `$V screenshot /threads/49922569 "$D/start-id-running.png"`. The banner shows a `Running` badge.
- **Live progress.** Without navigating, `preview_wait_for` text `Last run completed` with `timeoutMs: 60000`, repeated until it appears (about 45–100 s), or run `$V wait-run 49922569`. Read the same tab again with `preview_evaluate`: the status line reads `Last run completed`, and `performance.getEntriesByType('navigation').length` is still `1`, which proves the page updated without a reload. Run `$V screenshot /threads/49922569 "$D/start-id-completed.png"`.
- **Start by URL.** From `/`, submit `https://news.ycombinator.com/item?id=49922569`. It lands on the same thread page and starts a new run. Wait for it to finish before going on.
- **Recent runs.** Navigate to `/`. The `Recent runs` list has one row per thread. The row for `Ask HN: Who is hiring? (October 2026)` shows `319 of 319 comments` (or the current total) and `Completed`. Run `$V screenshot / "$D/start-recent.png"`.
- **Proof.** `$V db 49922569 "$D"`. `ingestion_runs.txt` has one `completed` row per run you started, with `processed_comments = total_comments`. `comments_by_eligibility.txt` and `skill_mentions_summary.txt` are non-empty.

## Gotchas

- The first request after `up` compiles the route in `next dev` and can take 5–10 s. Use a wait, not a sleep.
- Each thread has one workflow ID, `ingest-thread-<id>`. Starting it while it's running opens the existing run and adds no `ingestion_runs` row.
- The home page shows only the latest run per thread, so earlier runs of the same thread appear only in `ingestion_runs.txt`.
- Ingestion reads the live HN API. Totals can drift between days as comments are edited or deleted. Assert screen against `$V db`, not against old numbers.
- A run that fails partway through stays on the thread page with the failed banner. See [Failed run](./failed-run.md).
- While a run is in progress, the banner's `N of M` trails the totals and table by up to one batch of 25 comments, because progress is recorded per batch and comments are stored one by one. On 2026-10-31 the banner read `0 of 319` while the totals already showed 19 comments. Compare counts only after the run completes.
- `Fetching thread…` shows for only a few seconds before it turns into `Processing comments`. Capture it with `preview_evaluate` straight after the redirect, not with a slow screenshot.
