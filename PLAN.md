# Walking skeleton plan

Question answered: which skills do employers request in a given Hacker News
"Who is hiring?" thread. Scope is one thread at a time, demand within HN hiring
posts only.

## Steps and completion criteria

1. Workspace and infrastructure
   - Next.js 16 + TypeScript app, Postgres 17 in Docker, Temporal dev server.
   - Done when `pnpm db:migrate` creates the schema and `pnpm worker` connects.
2. Extraction rules (pure functions, unit tested)
   - Eligibility: top-level comment, not deleted or dead, not by `whoishiring`,
     first line contains the `|` header separator used by hiring posts.
   - Skill vocabulary: fixed list in `src/lib/skills.ts` with alias patterns.
   - Mention classes per sentence: `requested`, `preferred`, `stack`, `header`,
     `unclassified`. Only `requested` and `preferred` count as employer demand.
   - Done when `pnpm test` passes against excerpts taken from real comments.
3. Temporal ingestion
   - Workflow `ingestHiringThread(threadId)`: validate the thread, then process
     comment IDs in batches of 25 through one activity per batch.
   - Activities fetch from the HN API, upsert by HN item ID, and replace skill
     mentions per comment and extraction version inside one transaction.
   - Done when running ingestion twice yields identical row counts.
4. UI
   - Home: enter a thread ID, start ingestion, list known threads.
   - Thread page: run status, eligible posting count, per-skill counts with
     percentages of eligible postings, excerpts with HN links.
   - Done when a real thread's data appears in the browser, and empty and
     failed states are visible.
5. Verification
   - Repeat ingestion, kill and restart the worker mid-run, compare a manual
     sample of comments with the stored eligibility and mentions.
