import { createHash } from "node:crypto";
import { ApplicationFailure, heartbeat } from "@temporalio/activity";
import { getSql } from "../lib/db";
import { EXTRACTION_VERSION, decideEligibility, extractSkillMentions } from "../lib/extraction";
import { checkHiringThread, fetchHnItem, hnHtmlToPlainText, type HnItem } from "../lib/hn";
import type { CommentBatchInput, CommentBatchResult, RunKey, ThreadSummary } from "./shared";

export async function recordRunStarted({ workflowId, runId, threadId }: RunKey & { threadId: number }): Promise<void> {
  const sql = getSql();
  await sql`
    insert into ingestion_runs (workflow_id, run_id, thread_id, status)
    values (${workflowId}, ${runId}, ${threadId}, 'running')
    on conflict (workflow_id, run_id) do nothing
  `;
}

export async function fetchAndStoreThread({ workflowId, runId, threadId }: RunKey & { threadId: number }): Promise<ThreadSummary> {
  const item = await fetchHnItem(threadId);
  if (item === null) {
    throw ApplicationFailure.nonRetryable(`HN item ${threadId} does not exist`, "NotAHiringThread");
  }
  const check = checkHiringThread(item);
  if (!check.isHiringThread) {
    throw ApplicationFailure.nonRetryable(`HN item ${threadId} is not a hiring thread: ${check.reason}`, "NotAHiringThread");
  }
  const commentIds = item.kids ?? [];
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`
      insert into hiring_threads (id, title, posted_by, posted_at, reported_comment_count)
      values (${item.id}, ${item.title ?? ""}, ${item.by ?? ""}, ${new Date((item.time ?? 0) * 1000)}, ${item.descendants ?? commentIds.length})
      on conflict (id) do update set
        title = excluded.title,
        reported_comment_count = excluded.reported_comment_count,
        last_fetched_at = now()
    `;
    await tx`
      update ingestion_runs set total_comments = ${commentIds.length}
      where workflow_id = ${workflowId} and run_id = ${runId}
    `;
  });
  return { threadId, title: item.title ?? "", commentIds };
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function storeComment(threadId: number, commentId: number, item: HnItem | null): Promise<void> {
  const sql = getSql();
  const resolved: HnItem = item ?? { id: commentId, parent: threadId, deleted: true };
  const decision = decideEligibility(resolved, threadId);
  const textHtml = resolved.text ?? null;
  const textPlain = textHtml === null ? null : hnHtmlToPlainText(textHtml);
  const contentHash = textHtml === null ? null : hashText(textHtml);
  const mentions = decision.eligibility === "posting" && textPlain !== null ? extractSkillMentions(textPlain) : [];
  const postedAt = resolved.time === undefined ? null : new Date(resolved.time * 1000);

  await sql.begin(async (tx) => {
    await tx`
      insert into comments (id, thread_id, author, posted_at, text_html, text_plain, content_hash, is_deleted, is_dead, eligibility, eligibility_reason, text_changed_at)
      values (${commentId}, ${threadId}, ${resolved.by ?? null}, ${postedAt}, ${textHtml}, ${textPlain}, ${contentHash}, ${resolved.deleted ?? false}, ${resolved.dead ?? false}, ${decision.eligibility}, ${decision.reason}, now())
      on conflict (id) do update set
        author = excluded.author,
        posted_at = excluded.posted_at,
        text_html = excluded.text_html,
        text_plain = excluded.text_plain,
        content_hash = excluded.content_hash,
        is_deleted = excluded.is_deleted,
        is_dead = excluded.is_dead,
        eligibility = excluded.eligibility,
        eligibility_reason = excluded.eligibility_reason,
        last_fetched_at = now(),
        text_changed_at = case when comments.content_hash is distinct from excluded.content_hash then now() else comments.text_changed_at end
    `;
    await tx`delete from skill_mentions where comment_id = ${commentId} and extraction_version = ${EXTRACTION_VERSION}`;
    if (mentions.length > 0) {
      const rows = mentions.map((mention) => ({
        comment_id: commentId,
        skill_key: mention.skillKey,
        mention_class: mention.mentionClass,
        excerpt: mention.excerpt,
        extraction_version: EXTRACTION_VERSION,
      }));
      await tx`insert into skill_mentions ${tx(rows)}`;
    }
  });
}

export async function ingestCommentBatch({ workflowId, runId, threadId, commentIds, processedBefore }: CommentBatchInput): Promise<CommentBatchResult> {
  let processed = 0;
  for (const commentId of commentIds) {
    const item = await fetchHnItem(commentId);
    await storeComment(threadId, commentId, item);
    processed += 1;
    heartbeat({ processed });
  }
  const sql = getSql();
  await sql`
    update ingestion_runs set processed_comments = ${processedBefore + processed}
    where workflow_id = ${workflowId} and run_id = ${runId}
  `;
  return { processed };
}

export async function recordRunFinished({ workflowId, runId, processed }: RunKey & { processed: number }): Promise<void> {
  const sql = getSql();
  await sql`
    update ingestion_runs set status = 'completed', processed_comments = ${processed}, finished_at = now()
    where workflow_id = ${workflowId} and run_id = ${runId}
  `;
}

export async function recordRunFailed({ workflowId, runId, error }: RunKey & { error: string }): Promise<void> {
  const sql = getSql();
  await sql`
    update ingestion_runs set status = 'failed', error = ${error}, finished_at = now()
    where workflow_id = ${workflowId} and run_id = ${runId}
  `;
}
