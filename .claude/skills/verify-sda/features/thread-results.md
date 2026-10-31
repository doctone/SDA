# Thread results

For an ingested thread, the thread page shows comment totals, a short explanation of how skills are counted, a ranked table of skills with bars for the share of eligible postings that ask for each skill, and, when a skill is opened, excerpt cards with the skill highlighted and a link to the source HN comment.

## Sub-features

- `results-header` shows the thread title, a `View on HN` link to `https://news.ycombinator.com/item?id=<id>`, and the posted time in UTC.
- `results-totals` shows `Eligible postings`, `Top-level comments`, `Discussion, not a posting` and `Deleted, dead or empty`.
- `results-explainer` shows `How skills are counted`, defining "asked for" and "mentioned".
- `results-table` ranks skills by `Asked for in postings` as `N · P%` of eligible postings, with `Required`, `Preferred` and `Mentioned` columns.
- `results-excerpts` opens one skill's excerpt cards, ordered Required, Preferred, Stack, Header, Other, with the skill wrapped in `mark`.
- `results-source-link` gives each card an `<author> on HN ↗` link to the comment.
- `results-collapse` clicking the open row closes it and returns to `/threads/<id>`.

## How to get to it (user POV)

- Click a thread row in `Recent runs` on `/`.
- Arrive automatically after starting a run (see [Start a run](./start-run.md)).
- Open `/threads/<id>` or `/threads/<id>?skill=<key>` directly.

## Driving it with verify-sda and the T3 browser

Preconditions:

- Baseline from the README, plus thread `49922569` ingested with its latest run `completed`. If not, drive [Start a run](./start-run.md) first.

- **Open from home.** On `/`, `preview_click` on `role=link[name=/Who is hiring\? \(October 2026\)/]`. The URL becomes `/threads/49922569` and the `h1` reads `Ask HN: Who is hiring? (October 2026)`.
- **Totals.** `preview_evaluate` with `[...document.querySelectorAll('dl div')].map(d => d.innerText)`. The four values must equal `comments_by_eligibility.txt`: posting is `Eligible postings`, not_posting is `Discussion, not a posting`, excluded is `Deleted, dead or empty`, and their sum is `Top-level comments`.
- **Table.** The first rows rank by the `N` in `N · P%`. For any row, `N` equals the distinct postings with class `requested` or `preferred` for that skill, and `Mentioned` equals the distinct postings across all classes. Cross-check one skill with `skill_mentions.txt`. `P` is `round(N / eligible postings × 100)`. Save `results-table.png`.
- **Open excerpts.** `preview_click` on `role=link[name=/Python/]`. `preview_wait_for` with `urlIncludes: "skill=python"` and locator `mark`. The row has `aria-expanded=true`. The cards start with `Required` labels and each highlights `Python`. Save `results-excerpts-python.png`.
- **Source link.** Read the first card's link with `preview_evaluate` on `document.querySelector('li li a').href`. It is `https://news.ycombinator.com/item?id=<comment id>`, and that comment ID and excerpt appear in `skill_mentions.txt` under `python`.
- **Collapse.** Click the same row again. The URL returns to `/threads/49922569` and no `mark` remains.
- **Proof.** `$V db 49922569 "$D"` alongside the screenshots.

## Gotchas

- The bar width scales to the top skill in the table, not to 100%. Check `P%`, not bar length.
- A skill with 0 asked-for postings still appears when it is mentioned. It sorts below every skill with demand.
- Python opens about 60 cards, so the page gets very long. Scroll or use `preview_evaluate` instead of expecting everything in one screenshot.
- An unknown `?skill=` value is ignored and no row opens.
- Counts include only `extraction_version = 'v1'` mentions on comments with eligibility `posting`.
