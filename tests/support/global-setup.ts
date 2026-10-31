import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { startFakeHn } from "./fake-hn";

declare module "vitest" {
  export interface ProvidedContext {
    appUrl: string;
    hnUrl: string;
    databaseUrl: string;
    temporalAddress: string;
  }
}

const ROOT = path.resolve(__dirname, "../..");
const TEST_DATABASE = "skills_test";
const TASK_QUEUE = "hn-ingestion-test";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function createTestDatabase(): Promise<string> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres:postgres@localhost:5433/postgres";
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${TEST_DATABASE} with (force)`);
  await admin.unsafe(`create database ${TEST_DATABASE}`);
  await admin.end();

  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = `/${TEST_DATABASE}`;
  const sql = postgres(databaseUrl.toString(), { max: 1, onnotice: () => {} });
  await sql.unsafe(readFileSync(path.join(ROOT, "db", "schema.sql"), "utf8"));
  await sql.end();
  return databaseUrl.toString();
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`))));
  });
}

function startUntilReady(name: string, command: string, args: string[], env: NodeJS.ProcessEnv, readyLine: RegExp): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (process.env.TEST_VERBOSE) {
        process.stdout.write(`[${name}] ${chunk.toString()}`);
      }
      if (readyLine.test(output)) {
        resolve(child);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`${name} exited with ${code} before it was ready:\n${output}`)));
  });
}

function stop(child: ChildProcess | undefined): Promise<void> {
  if (!child?.pid || child.exitCode !== null) {
    return Promise.resolve();
  }
  const pid = child.pid;
  return new Promise((resolve) => {
    const forceKill = setTimeout(() => process.kill(-pid, "SIGKILL"), 3000);
    child.removeAllListeners("exit");
    child.once("exit", () => {
      clearTimeout(forceKill);
      resolve();
    });
    process.kill(-pid, "SIGTERM");
  });
}

const bin = (name: string) => path.join(ROOT, "node_modules", ".bin", name);

export default async function setup(project: TestProject) {
  const [databaseUrl, hn, temporal, appPort] = await Promise.all([
    createTestDatabase(),
    startFakeHn(),
    TestWorkflowEnvironment.createLocal(),
    freePort(),
  ]);

  const appEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    TEMPORAL_ADDRESS: temporal.address,
    TEMPORAL_NAMESPACE: "default",
    TEMPORAL_TASK_QUEUE: TASK_QUEUE,
    TEMPORAL_API_KEY: undefined,
    TEMPORAL_WORKFLOW_BUNDLE: path.join(ROOT, "build/worker/workflow-bundle.js"),
    VERCEL_ENV: undefined,
    HN_API_URL: hn.url,
    NODE_ENV: "production",
  };

  let worker: ChildProcess | undefined;
  let app: ChildProcess | undefined;
  const teardown = async () => {
    await Promise.all([stop(app), stop(worker)]);
    await Promise.all([hn.close(), temporal.teardown()]);
  };

  try {
    await run("pnpm", ["build:worker"], appEnv);
    if (!process.env.SKIP_BUILD) {
      await run(bin("next"), ["build"], appEnv);
    }
    [worker, app] = await Promise.all([
      startUntilReady("worker", process.execPath, ["build/worker/src/temporal/worker.js"], appEnv, /worker listening/),
      startUntilReady("next", bin("next"), ["start", "-H", "127.0.0.1", "-p", String(appPort)], appEnv, /Ready/i),
    ]);
  } catch (error) {
    await teardown();
    throw error;
  }

  project.provide("appUrl", `http://127.0.0.1:${appPort}`);
  project.provide("hnUrl", hn.url);
  project.provide("databaseUrl", databaseUrl);
  project.provide("temporalAddress", temporal.address);

  return teardown;
}
