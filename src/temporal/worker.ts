import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { readEnv } from "../lib/env";
import { temporalConnectionOptions } from "./connection";

async function run(): Promise<void> {
  const env = readEnv();
  const connection = await NativeConnection.connect(temporalConnectionOptions(env));
  try {
    const worker = await Worker.create({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      ...(env.TEMPORAL_WORKFLOW_BUNDLE
        ? { workflowBundle: { codePath: env.TEMPORAL_WORKFLOW_BUNDLE } }
        : { workflowsPath: require.resolve("./workflows") }),
      activities,
      shutdownGraceTime: "20 seconds",
    });
    console.log(`worker listening on task queue ${env.TEMPORAL_TASK_QUEUE}`);
    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
