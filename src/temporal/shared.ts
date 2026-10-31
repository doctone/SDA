export type IngestHiringThreadInput = {
  threadId: number;
};

export type ThreadSummary = {
  threadId: number;
  title: string;
  commentIds: number[];
};

export type RunKey = {
  workflowId: string;
  runId: string;
};

export type CommentBatchInput = RunKey & {
  threadId: number;
  commentIds: number[];
  processedBefore: number;
};

export type CommentBatchResult = {
  processed: number;
};

export const COMMENT_BATCH_SIZE = 25;

export function workflowIdForThread(threadId: number): string {
  return `ingest-thread-${threadId}`;
}
