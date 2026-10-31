import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { RunStatusBadge } from "@/components/run-status-badge";
import { formatUtc } from "@/lib/format";
import { listRecentRuns, type RunSummary } from "@/lib/thread-data";
import { StartRunForm } from "./start-run-form";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Skills demand from HN hiring threads</h1>
      <p className="mt-2 text-zinc-600">
        Paste a &ldquo;Who is hiring?&rdquo; thread to count which skills employers ask for in it.
      </p>
      <div className="mt-8">
        <StartRunForm />
      </div>
      <section className="mt-12">
        <h2 className="text-sm font-medium text-zinc-900">Recent runs</h2>
        <Suspense fallback={<p className="mt-4 text-sm text-zinc-500">Loading runs…</p>}>
          <RecentRuns />
        </Suspense>
      </section>
    </main>
  );
}

async function RecentRuns() {
  await connection();
  const runs = await listRecentRuns();
  if (runs.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        No runs yet. Start one above with the ID of a &ldquo;Who is hiring?&rdquo; thread.
      </p>
    );
  }
  const hasRunning = runs.some((run) => run.status === "running");
  return (
    <>
      {hasRunning && <AutoRefresh />}
      <ul className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {runs.map((run) => (
          <li key={run.threadId}>
            <RunRow run={run} />
          </li>
        ))}
      </ul>
    </>
  );
}

function RunRow({ run }: { run: RunSummary }) {
  return (
    <Link href={`/threads/${run.threadId}`} className="block px-4 py-3 hover:bg-zinc-50">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-900">{run.title ?? `HN item ${run.threadId}`}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            <span className="font-mono">{run.threadId}</span> · started {formatUtc(run.startedAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-zinc-500 tabular-nums">{describeProgress(run)}</span>
          <RunStatusBadge status={run.status} />
        </div>
      </div>
      {run.status === "failed" && run.error && <p className="mt-2 truncate text-xs text-red-700">{run.error}</p>}
    </Link>
  );
}

function describeProgress(run: RunSummary): string {
  if (run.totalComments === null) {
    return run.status === "running" ? "Fetching thread…" : "";
  }
  return `${run.processedComments} of ${run.totalComments} comments`;
}
