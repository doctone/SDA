import { getSql } from "./db";
import { EXTRACTION_VERSION, type MentionClass } from "./extraction";

export type RunStatus = "running" | "completed" | "failed";

export type RunSummary = {
  threadId: number;
  title: string | null;
  status: RunStatus;
  totalComments: number | null;
  processedComments: number;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

export type ThreadOverview = {
  threadId: number;
  title: string | null;
  postedAt: Date | null;
  latestRun: RunSummary | null;
  topLevelComments: number;
  eligiblePostings: number;
  discussion: number;
  excluded: number;
};

export type SkillDemand = {
  skillKey: string;
  demandPostings: number;
  requestedPostings: number;
  preferredPostings: number;
  mentionedPostings: number;
};

export type SkillExcerpt = {
  commentId: number;
  author: string | null;
  mentionClass: MentionClass;
  excerpt: string;
};

export async function listRecentRuns(limit = 20): Promise<RunSummary[]> {
  const sql = getSql();
  return sql<RunSummary[]>`
    select * from (
      select distinct on (r.thread_id)
        r.thread_id::integer as "threadId",
        t.title,
        r.status,
        r.total_comments as "totalComments",
        r.processed_comments as "processedComments",
        r.error,
        r.started_at as "startedAt",
        r.finished_at as "finishedAt"
      from ingestion_runs r
      left join hiring_threads t on t.id = r.thread_id
      order by r.thread_id, r.started_at desc
    ) latest
    order by "startedAt" desc
    limit ${limit}
  `;
}

export async function getThreadOverview(threadId: number): Promise<ThreadOverview | null> {
  const sql = getSql();
  const [threadRows, runRows, countRows] = await Promise.all([
    sql<{ title: string; postedAt: Date }[]>`
      select title, posted_at as "postedAt" from hiring_threads where id = ${threadId}
    `,
    sql<RunSummary[]>`
      select
        r.thread_id::integer as "threadId",
        null as title,
        r.status,
        r.total_comments as "totalComments",
        r.processed_comments as "processedComments",
        r.error,
        r.started_at as "startedAt",
        r.finished_at as "finishedAt"
      from ingestion_runs r
      where r.thread_id = ${threadId}
      order by r.started_at desc
      limit 1
    `,
    sql<{ topLevelComments: number; eligiblePostings: number; discussion: number; excluded: number }[]>`
      select
        count(*)::integer as "topLevelComments",
        (count(*) filter (where eligibility = 'posting'))::integer as "eligiblePostings",
        (count(*) filter (where eligibility = 'not_posting'))::integer as discussion,
        (count(*) filter (where eligibility = 'excluded'))::integer as excluded
      from comments
      where thread_id = ${threadId}
    `,
  ]);
  const thread = threadRows[0];
  const latestRun = runRows[0] ?? null;
  if (!thread && !latestRun) {
    return null;
  }
  return {
    threadId,
    title: thread?.title ?? null,
    postedAt: thread?.postedAt ?? null,
    latestRun,
    ...countRows[0],
  };
}

export async function getSkillDemand(threadId: number): Promise<SkillDemand[]> {
  const sql = getSql();
  return sql<SkillDemand[]>`
    select
      m.skill_key as "skillKey",
      (count(distinct m.comment_id) filter (where m.mention_class in ('requested', 'preferred')))::integer as "demandPostings",
      (count(distinct m.comment_id) filter (where m.mention_class = 'requested'))::integer as "requestedPostings",
      (count(distinct m.comment_id) filter (where m.mention_class = 'preferred'))::integer as "preferredPostings",
      count(distinct m.comment_id)::integer as "mentionedPostings"
    from skill_mentions m
    join comments c on c.id = m.comment_id
    where c.thread_id = ${threadId}
      and c.eligibility = 'posting'
      and m.extraction_version = ${EXTRACTION_VERSION}
    group by m.skill_key
    order by "demandPostings" desc, "mentionedPostings" desc, m.skill_key
  `;
}

export async function getSkillExcerpts(threadId: number, skillKey: string): Promise<SkillExcerpt[]> {
  const sql = getSql();
  return sql<SkillExcerpt[]>`
    select
      c.id::integer as "commentId",
      c.author,
      m.mention_class as "mentionClass",
      m.excerpt
    from skill_mentions m
    join comments c on c.id = m.comment_id
    where c.thread_id = ${threadId}
      and c.eligibility = 'posting'
      and m.skill_key = ${skillKey}
      and m.extraction_version = ${EXTRACTION_VERSION}
    order by
      array_position(array['requested', 'preferred', 'stack', 'header', 'unclassified'], m.mention_class),
      c.id,
      m.id
  `;
}

export async function hasRunRecord(workflowId: string, runId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`select 1 from ingestion_runs where workflow_id = ${workflowId} and run_id = ${runId}`;
  return rows.length > 0;
}
