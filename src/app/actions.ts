"use server";

import { setTimeout as sleep } from "node:timers/promises";
import { redirect } from "next/navigation";
import { hasRunRecord } from "@/lib/thread-data";
import { parseThreadInput } from "@/lib/thread-input";
import { startIngestion } from "@/temporal/client";

export type StartRunState = { message: string | null; input: string };

const RUN_RECORD_TIMEOUT_MS = 5000;
const RUN_RECORD_POLL_MS = 100;

async function waitForRunRecord(workflowId: string, runId: string): Promise<void> {
  const deadline = Date.now() + RUN_RECORD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await hasRunRecord(workflowId, runId)) {
      return;
    }
    await sleep(RUN_RECORD_POLL_MS);
  }
}

export async function startRun(_previous: StartRunState, formData: FormData): Promise<StartRunState> {
  const raw = formData.get("thread");
  const input = typeof raw === "string" ? raw : "";
  const parsed = parseThreadInput(input);
  if (!parsed.ok) {
    return { message: parsed.message, input };
  }
  try {
    const result = await startIngestion(parsed.threadId);
    if (result.started) {
      await waitForRunRecord(result.workflowId, result.runId);
    }
  } catch (error) {
    console.error("startIngestion failed", error);
    return { message: "Could not start the run. Check that Temporal is up with docker compose ps.", input };
  }
  redirect(`/threads/${parsed.threadId}`);
}
