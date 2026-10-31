# Walking skeleton plan

Question answered: which skills do employers request in a given Hacker News
"Who is hiring?" thread. Scope is one thread at a time, demand within HN hiring
posts only.

## Steps and completion criteria

1. Containerised stack. Done.
   - One `docker compose up` runs Postgres, Temporal, Temporal UI, migrations,
     the worker and the web app.
   - Verified: a real thread ingests end to end, a repeat run changes no
     counts, a down and up keeps data, and killing the worker mid-run
     recovers with identical counts.
2. Extraction rules (pure functions, unit tested). Done for v1.
   - Eligibility: top-level comment, not deleted or dead, not by `whoishiring`,
     first line contains the `|` header separator used by hiring posts.
   - Skill vocabulary: fixed list in `src/lib/skills.ts` with alias patterns.
   - Mention classes per sentence: `requested`, `preferred`, `stack`, `header`,
     `unclassified`. Only `requested` and `preferred` count as employer demand.
3. Temporal ingestion. Done.
   - Workflow `ingestHiringThread(threadId)` validates the thread, then
     processes comment IDs in batches of 25, one activity per batch.
   - Activities upsert by HN item ID and replace skill mentions per comment
     and extraction version inside one transaction.
4. UI design with Mobbin. Done.
   - Two screens: thread entry with run status, and thread results with skill
     counts, percentages of eligible postings, and source excerpts.
   - Direction: Firecrawl's input with a recent-runs list, Pipedrive's
     in-progress banner, Etsy's ranked table with bars, and Dovetail's
     highlighted excerpt cards.
5. UI build in Tailwind, then verification. In progress.
   - Done: real data in the browser, with running, failed, empty and
     not-analysed states checked by hand.
   - Next: a manual sample check of eligibility and skill counts.
