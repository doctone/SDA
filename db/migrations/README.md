Add append-only SQL files named `0001_description.sql`, `0002_description.sql`, etc.
`db/schema.sql` is the frozen initial migration, including for databases created
before the migration ledger existed. Do not edit it or previously applied SQL.

All pending migrations and their ledger entries run in one transaction under a
Postgres advisory transaction lock. A failure rolls back the whole batch. This
works with Neon's pooled connection. SQL must support transactions; do not use
`CREATE INDEX CONCURRENTLY` or explicit transaction statements here.

Use additive changes first. The previous web app and worker run while migration
executes, and a later deploy can fail. Remove columns only in a later release
after all consumers stop using them. Rollback application code without reversing
migrations; repair schema mistakes with a new migration.
