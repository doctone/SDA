import { Client, Connection, WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { readEnv } from "../lib/env";
import { workflowIdForThread, type IngestHiringThreadInput } from "./shared";

const globalForTemporal = globalThis as unknown as { temporalClient?: Promise<Client> };

async function createClient(): Promise<Client> {
  const env = readEnv();
  const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS });
  return new Client({ connection, namespace: env.TEMPORAL_NAMESPACE });
}

export function getTemporalClient(): Promise<Client> {
  if (!globalForTemporal.temporalClient) {
    globalForTemporal.temporalClient = createClient();
  }
  return globalForTemporal.temporalClient;
}

export type StartIngestionResult = { started: true; workflowId: string; runId: string } | { started: false; reason: "already-running"; workflowId: string };

export async function startIngestion(threadId: number): Promise<StartIngestionResult> {
  const client = await getTemporalClient();
  const workflowId = workflowIdForThread(threadId);
  const input: IngestHiringThreadInput = { threadId };
  try {
    const handle = await client.workflow.start("ingestHiringThread", {
      workflowId,
      taskQueue: readEnv().TEMPORAL_TASK_QUEUE,
      args: [input],
      workflowIdConflictPolicy: "FAIL",
    });
    return { started: true, workflowId, runId: handle.firstExecutionRunId };
  } catch (error) {
    if (error instanceof WorkflowExecutionAlreadyStartedError) {
      return { started: false, reason: "already-running", workflowId };
    }
    throw error;
  }
}
