import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { AutoRefresh } from "@/components/auto-refresh";
import { HighlightedExcerpt } from "@/components/highlighted-excerpt";
import { RunStatusBadge } from "@/components/run-status-badge";
import type { MentionClass } from "@/lib/extraction";
import { formatPercent, formatUtc } from "@/lib/format";
import { SKILL_LABELS } from "@/lib/skills";
import {
  getSkillDemand,
  getSkillExcerpts,
  getThreadOverview,
  type RunSummary,
  type SkillDemand,
  type ThreadOverview,
} from "@/lib/thread-data";
import { RerunButton } from "./rerun-button";

const threadIdSchema = z.coerce.number().int().positive();

export default function ThreadPage(props: PageProps<"/threads/[id]">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← All runs
      </Link>
      <Suspense fallback={<p className="mt-6 text-sm text-zinc-500">Loading thread…</p>}>
        <ThreadView {...props} />
      </Suspense>
    </main>
  );
}

async function ThreadView({ params, searchParams }: PageProps<"/threads/[id]">) {
  await connection();
  const parsedId = threadIdSchema.safeParse((await params).id);
  if (!parsedId.success) {
    notFound();
  }
  const threadId = parsedId.data;
  const skillParam = (await searchParams).skill;
  const selectedSkill = typeof skillParam === "string" && skillParam in SKILL_LABELS ? skillParam : null;

  const overview = await getThreadOverview(threadId);
  if (!overview) {
    return <NotAnalysed threadId={threadId} />;
  }
  const demand = overview.eligiblePostings > 0 ? await getSkillDemand(threadId) : [];
  const isRunning = overview.latestRun?.status === "running";
  const hasComments = overview.topLevelComments > 0;

  return (
    <>
      {isRunning && <AutoRefresh />}
      <header className="mt-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{overview.title ?? `HN item ${threadId}`}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <a
              href={`https://news.ycombinator.com/item?id=${threadId}`}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
            >
              View on HN
            </a>
            {overview.postedAt && <> · posted {formatUtc(overview.postedAt)}</>}
          </p>
        </div>
        {overview.latestRun && !isRunning && <RerunButton threadId={threadId} label="Run again" />}
      </header>

      {overview.latestRun && <RunBanner run={overview.latestRun} hasEarlierData={hasComments} />}

      {(hasComments || isRunning) && (
        <>
          {hasComments && <CommentCounts overview={overview} />}
          <ClassExplainer />
          <SkillTable
            threadId={threadId}
            demand={demand}
            eligiblePostings={overview.eligiblePostings}
            selectedSkill={selectedSkill}
            isRunning={isRunning}
          />
        </>
      )}
    </>
  );
}

function NotAnalysed({ threadId }: { threadId: number }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
      <h1 className="text-lg font-semibold">HN item {threadId} has not been analysed</h1>
      <p className="mt-1 text-sm text-zinc-500">Start a run to fetch the thread and count the skills in it.</p>
      <div className="mt-4 flex justify-center">
        <RerunButton threadId={threadId} label="Analyse thread" />
      </div>
    </div>
  );
}

function RunBanner({ run, hasEarlierData }: { run: RunSummary; hasEarlierData: boolean }) {
  if (run.status === "running") {
    const total = run.totalComments;
    const width = total ? `${Math.round((run.processedComments / total) * 100)}%` : "0%";
    return (
      <div role="status" className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-blue-900">
            {total === null ? "Fetching thread…" : `Processing comments: ${run.processedComments} of ${total}`}
          </span>
          <RunStatusBadge status="running" />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width }} />
        </div>
      </div>
    );
  }
  if (run.status === "failed") {
    return (
      <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-red-900">The last run failed</span>
          <RunStatusBadge status="failed" />
        </div>
        {run.error && <p className="mt-2 font-mono text-xs break-words text-red-800">{run.error}</p>}
        <p className="mt-2 text-xs text-red-700">
          Started {formatUtc(run.startedAt)}.
          {hasEarlierData ? " Counts below come from earlier data." : " No data has been stored for this thread."}
        </p>
      </div>
    );
  }
  return (
    <p className="mt-4 text-xs text-zinc-500">
      Last run completed {run.finishedAt ? formatUtc(run.finishedAt) : ""} · {run.processedComments} comments processed
    </p>
  );
}

function CommentCounts({ overview }: { overview: ThreadOverview }) {
  const items = [
    { label: "Eligible postings", value: overview.eligiblePostings, isPrimary: true },
    { label: "Top-level comments", value: overview.topLevelComments, isPrimary: false },
    { label: "Discussion, not a posting", value: overview.discussion, isPrimary: false },
    { label: "Deleted, dead or empty", value: overview.excluded, isPrimary: false },
  ];
  return (
    <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-white p-4">
          <dt className="text-xs text-zinc-500">{item.label}</dt>
          <dd className={`mt-1 text-2xl tabular-nums ${item.isPrimary ? "font-semibold" : "text-zinc-700"}`}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ClassExplainer() {
  return (
    <section className="mt-8 text-sm text-zinc-600">
      <h2 className="font-medium text-zinc-900">How skills are counted</h2>
      <p className="mt-1">
        Each eligible posting is split into sentences. A skill counts as <strong>asked for</strong> when a sentence
        naming it reads as a requirement (&ldquo;experience with&rdquo;, &ldquo;you have&rdquo;, &ldquo;must&rdquo;)
        or a preference (&ldquo;nice to have&rdquo;, &ldquo;bonus&rdquo;). Skills that only appear in a description of
        the company&rsquo;s stack, in the header line, or in other text are listed under <strong>mentioned</strong> but
        not counted as demand. Percentages are of eligible postings. Results cover this HN thread only, not the wider
        job market.
      </p>
    </section>
  );
}

function SkillTable({
  threadId,
  demand,
  eligiblePostings,
  selectedSkill,
  isRunning,
}: {
  threadId: number;
  demand: SkillDemand[];
  eligiblePostings: number;
  selectedSkill: string | null;
  isRunning: boolean;
}) {
  if (demand.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
        {isRunning
          ? "Skill counts appear here as comments are processed."
          : "No skills found. The thread has no eligible postings, or none name a skill on the list."}
      </p>
    );
  }
  const maxDemand = Math.max(1, ...demand.map((row) => row.demandPostings));
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="grid grid-cols-[minmax(0,10rem)_1fr_4.5rem_4.5rem_5rem] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-500 uppercase">
        <span>Skill</span>
        <span>Asked for in postings</span>
        <span className="text-right">Required</span>
        <span className="text-right">Preferred</span>
        <span className="text-right">Mentioned</span>
      </div>
      <ul className="divide-y divide-zinc-100">
        {demand.map((row) => {
          const isSelected = row.skillKey === selectedSkill;
          return (
            <li key={row.skillKey} className={isSelected ? "bg-orange-50/40" : undefined}>
              <Link
                href={isSelected ? `/threads/${threadId}` : `/threads/${threadId}?skill=${row.skillKey}`}
                scroll={false}
                aria-expanded={isSelected}
                className="grid grid-cols-[minmax(0,10rem)_1fr_4.5rem_4.5rem_5rem] items-center gap-4 px-4 py-2.5 text-sm hover:bg-zinc-50"
              >
                <span className="truncate font-medium">
                  <span className="mr-1 inline-block w-3 text-zinc-400">{isSelected ? "▾" : "▸"}</span>
                  {SKILL_LABELS[row.skillKey] ?? row.skillKey}
                </span>
                <span className="flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <span
                      className="block h-full rounded-full bg-orange-500"
                      style={{ width: `${(row.demandPostings / maxDemand) * 100}%` }}
                    />
                  </span>
                  <span className="w-20 text-right text-zinc-700 tabular-nums">
                    {row.demandPostings} · {formatPercent(row.demandPostings, eligiblePostings)}
                  </span>
                </span>
                <span className="text-right text-zinc-600 tabular-nums">{row.requestedPostings}</span>
                <span className="text-right text-zinc-600 tabular-nums">{row.preferredPostings}</span>
                <span className="text-right text-zinc-600 tabular-nums">{row.mentionedPostings}</span>
              </Link>
              {isSelected && (
                <Suspense fallback={<p className="px-4 pb-4 text-sm text-zinc-500">Loading excerpts…</p>}>
                  <Excerpts threadId={threadId} skillKey={row.skillKey} />
                </Suspense>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const CLASS_LABELS: Record<MentionClass, { label: string; className: string }> = {
  requested: { label: "Required", className: "bg-orange-100 text-orange-800" },
  preferred: { label: "Preferred", className: "bg-amber-100 text-amber-800" },
  stack: { label: "Stack", className: "bg-zinc-100 text-zinc-700" },
  header: { label: "Header", className: "bg-zinc-100 text-zinc-700" },
  unclassified: { label: "Other", className: "bg-zinc-100 text-zinc-500" },
};

async function Excerpts({ threadId, skillKey }: { threadId: number; skillKey: string }) {
  const excerpts = await getSkillExcerpts(threadId, skillKey);
  return (
    <ul className="space-y-2 px-4 pb-4">
      {excerpts.map((excerpt, index) => {
        const classStyle = CLASS_LABELS[excerpt.mentionClass];
        return (
          <li key={`${excerpt.commentId}-${index}`} className="rounded-lg border border-zinc-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className={`rounded px-1.5 py-0.5 font-medium ${classStyle.className}`}>{classStyle.label}</span>
              <a
                href={`https://news.ycombinator.com/item?id=${excerpt.commentId}`}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-500 hover:text-zinc-900"
              >
                {excerpt.author ?? "unknown"} on HN ↗
              </a>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-800">
              <HighlightedExcerpt text={excerpt.excerpt} skillKey={skillKey} />
            </p>
          </li>
        );
      })}
    </ul>
  );
}
