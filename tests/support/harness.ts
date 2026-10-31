import { Client, Connection } from "@temporalio/client";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, inject } from "vitest";
import type { HnItem } from "../../src/lib/hn";

const appUrl = inject("appUrl");
const hnUrl = inject("hnUrl");

let browser: Browser;
let context: BrowserContext | undefined;
let temporal: Client;
let connection: Connection;
const sql = postgres(inject("databaseUrl"), { max: 1, onnotice: () => {} });

async function controlHn(path: string, body?: unknown): Promise<void> {
  const response = await fetch(`${hnUrl}${path}`, {
    method: path === "/__items" ? "PUT" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`fake HN ${path} returned ${response.status}: ${await response.text()}`);
  }
}

export const hn = {
  publish: (...items: HnItem[]) => controlHn("/__items", items),
  hold: (...ids: number[]) => controlHn("/__hold", { ids }),
  release: () => controlHn("/__release"),
};

export async function openPage(path: string): Promise<Page> {
  context = await browser.newContext({ baseURL: appUrl });
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

async function terminateRunningWorkflows(): Promise<void> {
  for await (const workflow of temporal.workflow.list({ query: 'ExecutionStatus="Running"' })) {
    await temporal.workflow.getHandle(workflow.workflowId).terminate("test reset");
  }
}

beforeAll(async () => {
  browser = await chromium.launch();
  connection = await Connection.connect({ address: inject("temporalAddress") });
  temporal = new Client({ connection });
});

beforeEach(async () => {
  await controlHn("/__reset");
  await terminateRunningWorkflows();
  await sql`truncate skill_mentions, comments, ingestion_runs, hiring_threads restart identity`;
});

afterEach(async () => {
  await context?.close();
  context = undefined;
  await controlHn("/__release");
});

afterAll(async () => {
  await browser?.close();
  await connection?.close();
  await sql.end();
});
