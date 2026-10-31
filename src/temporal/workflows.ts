import { ActivityFailure, proxyActivities, workflowInfo } from "@temporalio/workflow";
import type * as activities from "./activities";
import { COMMENT_BATCH_SIZE, type IngestHiringThreadInput } from "./shared";

const { recordRunStarted, fetchAndStoreThread, ingestCommentBatch, recordRunFinished, recordRunFailed } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "5 minutes",
    heartbeatTimeout: "1 minute",
    retry: { maximumAttempts: 8 },
  });

export async function ingestHiringThread({ threadId }: IngestHiringThreadInput): Promise<void> {
  const { workflowId, runId } = workflowInfo();
  const runKey = { workflowId, runId };
  await recordRunStarted({ ...runKey, threadId });
  try {
    const thread = await fetchAndStoreThread({ ...runKey, threadId });
    let processed = 0;
    for (let start = 0; start < thread.commentIds.length; start += COMMENT_BATCH_SIZE) {
      const batch = thread.commentIds.slice(start, start + COMMENT_BATCH_SIZE);
      const result = await ingestCommentBatch({ ...runKey, threadId, commentIds: batch, processedBefore: processed });
      processed += result.processed;
    }
    await recordRunFinished({ ...runKey, processed });
  } catch (error) {
    await recordRunFailed({ ...runKey, error: describeFailure(error) });
    throw error;
  }
}

function describeFailure(error: unknown): string {
  if (error instanceof ActivityFailure && error.cause) {
    return error.cause.message;
  }
  return error instanceof Error ? error.message : String(error);
}
