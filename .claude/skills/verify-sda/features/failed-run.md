# Failed run

When the latest run for a thread fails, the thread page shows a red banner with the stored error and when the run started, says whether earlier data is shown, and offers `Run again`. The home page shows the thread with a `Failed` badge and the error under the title.

## Sub-features

- `failed-banner` shows `role=alert` with `The last run failed`, a `Failed` badge and the error text.
- `failed-no-data` for a thread that never ingested, says `No data has been stored for this thread.` and shows no totals, explainer or table.
- `failed-earlier-data` for a thread with earlier data, says `Counts below come from earlier data.` and keeps the table.
- `failed-rerun` the `Run again` button starts a new run.
- `failed-home-row` the home page row shows `HN item <id>`, a `Failed` badge and the error in red.

## How to get to it (user POV)

- Start a run for an item that isn't a hiring thread from `/`. It lands on its thread page as the failure is recorded.
- Click a `Failed` row in `Recent runs`.
- Open `/threads/<id>` for a thread whose latest run failed.

## Driving it with verify-sda and the T3 browser

Preconditions:

- Baseline from the README. Thread `1` has no earlier runs in this instance.

- **Trigger.** On `/`, type `1` and press `Analyse thread`. The page lands on `/threads/1`. If the run is still in flight, the running banner shows briefly. `preview_wait_for` text `The last run failed`, or run `$V wait-run 1`, which prints `failed`.
- **Banner.** The alert contains `HN item 1 is not a hiring thread: posted by pg, not whoishiring` and `No data has been stored for this thread.` There is no `Eligible postings` and no `How skills are counted`. Save `failed-banner.png`.
- **Home row.** Navigate to `/`. The `HN item 1` row shows `Failed` and the same error. Save `failed-home-row.png`.
- **Earlier data.** `failed-earlier-data` needs a thread that completed once and later failed. There is no deterministic way to cause that through the UI, so report it as skipped. Stopping the worker mid-run is not a way to cause it: the workflow resumes and completes.
- **Proof.** `$V db 1 "$D"`. `ingestion_runs.txt` has a `failed` row whose `error` matches the banner, with `total_comments` empty and `processed_comments = 0`. The other files have no rows.

## Gotchas

- Item `1` fails during validation without retries, so the failure lands within about a second. Other non-hiring items may fail the same way, but item `1` is the known one.
- A failure inside a comment batch retries up to 8 times first, so it can take minutes to show as failed.
- Some stored errors are only `ActivityFailure: Activity task failed`. That is the recorded value, not a rendering bug.
- `Run again` on item `1` fails again the same way and adds another `failed` row.
