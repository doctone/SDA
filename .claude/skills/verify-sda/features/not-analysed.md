# Not analysed

A thread ID that has never been run opens a page saying it has not been analysed, with a button to start a run. An ID that isn't a positive integer is a 404.

## Sub-features

- `not-analysed-empty` `/threads/<id>` with no runs shows `HN item <id> has not been analysed` and `Start a run to fetch the thread and count the skills in it.`
- `not-analysed-start` the `Analyse thread` button starts a run for that ID and shows the running or failed state.
- `not-analysed-invalid-id` `/threads/abc` and `/threads/0` render the Next.js not-found page.

## How to get to it (user POV)

- Type `/threads/<id>` into the address bar, or follow a shared link to a thread nobody has run in this instance.

## Driving it with verify-sda and the T3 browser

Preconditions:

- Baseline from the README. No run exists for thread `123`. Check with `$V db 123 "$D"`: `ingestion_runs.txt` reports `(0 rows)`.

- **Empty state.** `preview_navigate` to `localhost:3100/threads/123`. The `h1` reads `HN item 123 has not been analysed` and `role=button[name='Analyse thread']` is present. No `role=status` or `role=alert` banner is shown. Save `not-analysed.png`, or use `$V screenshot /threads/123 "$D/not-analysed.png"`.
- **Invalid ID.** `preview_navigate` to `localhost:3100/threads/abc`. The page shows `This page could not be found.`
- **Start from here.** Press `Analyse thread`. The page re-renders as a run state. Item `123` is a story by `beau`, not a `whoishiring` thread, so expect the failed banner. Use `1` or `49922569` if a known outcome is needed. Save `not-analysed-started.png`.
- **Proof.** `$V db 123 "$D"` before and after starting. The first shows `(0 rows)` in `ingestion_runs.txt`, the second shows a new row.

## Gotchas

- The not-found response is streamed with HTTP 200, so check the page text, not the status code.
- Starting a run here is a mutation. Once a run exists, the ID no longer shows this state in this instance; `$V down` and `$V up` reset it.
