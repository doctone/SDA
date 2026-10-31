# Hosted deployment

Vercel serves the web app, Neon stores application data, and a Render background
worker polls Temporal Cloud. The local Docker stack remains independent.

## Connection settings

Set these on both Vercel Production and the Render worker:

- `DATABASE_URL`: Neon pooled connection URL, preserving its SSL parameters.
- `TEMPORAL_ADDRESS`: `quickstart-doctone-sda.rozg0.tmprl.cloud:7233`
- `TEMPORAL_NAMESPACE`: `quickstart-doctone-sda.rozg0`
- `TEMPORAL_TASK_QUEUE`: `hn-ingestion-production`
- `TEMPORAL_API_KEY`: a service-account key with Write access to that namespace.

The key automatically enables TLS. Omit it for local Docker; an empty key is
invalid. Store keys only in provider secret settings. The initial production
key expires on 31 October 2027 and must be rotated before then.

## Render worker

Create a Blueprint from this repository using `render.yaml`. It defines one
Starter worker in Oregon, near the existing Temporal namespace. Enter the
database URL and API key when prompted. This is a paid, continuously running
worker; review Render's displayed cost before creating it.

`Dockerfile.worker` compiles the worker and prebundles workflows at build time.
The runtime runs as the `node` user, includes CA certificates for TLS, and uses
production dependencies. The pre-deploy command applies `db/schema.sql`.
This schema can be reapplied, but does not upgrade existing table definitions;
future column changes need explicit migrations.

Confirm a worker is polling `hn-ingestion-production` in Temporal Cloud.
The worker allows activities 20 seconds to finish on shutdown, within Render's
30-second termination window. Temporal retries unfinished work.

## Vercel

Use the repository root, the Next.js preset, and Node.js 24.x. Install with
`corepack pnpm install --frozen-lockfile`; build with `pnpm build`.
Redeploy after changing environment variables. Schema migration happens on
Render, not during the Vercel build.

Only Production gets Temporal credentials. Preview deployments reject ingestion
and can read their Neon preview branch. The Neon native integration creates
preview branches from the default branch, including its existing schema.

## Verify

Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` locally. Tests build and run
the production worker bundle against isolated local services and drive the web
app in Chromium. Build the Linux image with:

```sh
docker build -f Dockerfile.worker -t sda-worker .
```

After deploying, submit a valid HN hiring thread in the production app and
confirm the workflow completes and results appear. Rerun it to check updates.
Do not consider Cloud networking or credentials verified until this succeeds.

The current production UI allows any visitor to start ingestion. Use Vercel
deployment protection if this should be a private rollout.
