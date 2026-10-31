# SDA: skills demand from HN hiring threads

For hosted services, see [the deployment guide](docs/deployment.md).

Shows which skills employers request in a Hacker News "Who is hiring?" thread,
with the original excerpt and HN link behind every count. Results describe
demand within HN hiring posts only, not the wider job market.

## Run it

Requires Docker. Everything runs in containers.

```sh
docker compose up -d --build
pnpm ingest 49922569
```

`pnpm ingest` runs inside the worker container, so host Node is only needed
for that shortcut and for tests. Without pnpm:

```sh
docker compose exec worker pnpm exec tsx scripts/start-ingestion.ts 49922569
```

| Service | URL |
| --- | --- |
| Web app | http://localhost:3000 |
| Temporal UI | http://localhost:8233 |
| Postgres | `postgres://skills:skills@localhost:5433/skills` |

The web and worker containers mount the source, so edits reload without a
rebuild. After changing dependencies, rebuild with fresh `node_modules`
volumes:

```sh
docker compose up -d --build -V web worker
```

Without `-V`, the containers keep their old `node_modules`. `docker compose
down -v` deletes all data, including Temporal history.

## Services

- `postgres` holds the app database `skills` and Temporal's `temporal` and
  `temporal_visibility` databases.
- `temporal-schema` and `temporal-namespace` are one-shot setup jobs. Both
  are safe to rerun against existing data.
- `temporal` and `temporal-ui` run the Temporal server and its web UI.
- `migrate` applies `db/schema.sql`, then `worker` and `web` start.

## Tests

```sh
pnpm install
pnpm test
```
