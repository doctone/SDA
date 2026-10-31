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

The existing `sda-ingestion` service was created in the dashboard.
`render.yaml` describes the equivalent Blueprint configuration; editing it does
not update the existing service unless it is managed by a Blueprint. It defines one
Starter worker in Oregon, near the existing Temporal namespace. Enter the
database URL and API key when prompted. This is a paid, continuously running
worker; review Render's displayed cost before creating it.

`Dockerfile.worker` compiles the worker and prebundles workflows at build time.
The runtime runs as the `node` user, includes CA certificates for TLS, and uses
production dependencies. The pre-deploy command runs the versioned SQL migrations.
`db/schema.sql` is the frozen baseline; add changes in `db/migrations/`.
The ledger records checksums and rejects edits to applied migrations. Pending
migrations run atomically under a transaction lock, including on pooled Neon
connections. Failed migrations prevent the new worker from deploying.

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

## Production CI/CD

Every push to `main` runs typecheck, lint, and the integration tests. Only a
successful run reaches the production job. That job builds the web app, deploys
the exact tested commit to Render, waits for migrations and worker deployment to
succeed, then publishes the prebuilt web app to Vercel. PRs run checks and retain
Vercel Git previews, but cannot execute this production job.

Production runs are serialized and are not cancelled by later pushes. GitHub
may replace a pending run with a newer push, so rapid pushes can coalesce into
one release. Every release includes all earlier commits on main.

### Activate before merging this PR

1. Create the GitHub `production` environment. Restrict deployment branches to
   `main`. Leave required reviewers off for automatic deployment on merge.
2. Add environment secrets `RENDER_API_KEY` and `VERCEL_TOKEN`, with access to
   the existing Render service and Vercel project. Never put these in Git.
3. Add environment variables `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from the
   Vercel team and project settings. Render's existing service ID is in CI.
4. Confirm Render's pre-deploy command is
   `node build/worker/scripts/migrate.js`, and turn Auto-Deploy off. The script
   refuses to deploy if automatic deploys remain on. Changing `render.yaml`
   alone does not update the manually created service.
5. Require `Typecheck and lint` and `Tests` before merging into `main`, using a
   GitHub branch rule if your repository plan supports it.
6. Merge and inspect the first `Deploy production` job. `vercel.json` disables
   independent Git deployments of main; the CLI owns production deployments.
   Confirm Render and Vercel show the merged commit and run a real ingestion.

Until these steps and the first release succeed, CI/CD is prepared but not
verified in production. The current accounts have no GitHub deployment secrets.

Database and Temporal credentials stay in Render and Vercel. GitHub does not
need a separate Neon password; migrations run inside Render's pre-deploy step.
Vercel CLI pulls production environment settings for its build. Do not upload
`.vercel` or production build output as public artifacts.

### Database and Temporal changes

Both activities and workflows are bundled into the worker image on every
release. Temporal Cloud itself is managed infrastructure; namespace settings,
service accounts, and credentials are not deployed by this pipeline.

Keep workflow changes compatible with histories of running workflows. Use
Temporal's `patched` API for incompatible command-sequence changes and test
history replay before deployment. This pipeline does not automatically prove
replay compatibility or configure Worker Versioning. Activity implementations
can change independently if their inputs and outputs stay compatible.

Schema migrations must work with both the previous and next application
versions. Add columns first, migrate consumers, and remove obsolete columns in a
later release. See `db/migrations/README.md`. Tests initialize their database
through the same migration runner as production.

If migration or worker deployment fails, Vercel is not published. A Vercel
failure can leave the new worker and schema with the old web app. Fix forward
and rerun the failed job after inspecting provider state. Do not blindly undo
schema migrations. To roll back code, revert the application change while
retaining all migration files, then merge the revert through the same pipeline.

Provider references: [Render commit deployments](https://render.com/docs/deploys),
[Vercel CLI deployments](https://vercel.com/docs/cli/deploy), and
[Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).
