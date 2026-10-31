import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { readEnv } from "../lib/env";

async function run(): Promise<void> {
  const env = readEnv();
  const connection = await NativeConnection.connect({ address: env.TEMPORAL_ADDRESS });
  try {
    const worker = await Worker.create({
      connection,
      namespace: env.TEMPORAL_NAMESPACE,
      taskQueue: env.TEMPORAL_TASK_QUEUE,
      workflowsPath: require.resolve("./workflows"),
      activities,
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
