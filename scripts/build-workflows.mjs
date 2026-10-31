import { writeFile } from "node:fs/promises";
import { bundleWorkflowCode } from "@temporalio/worker";

const bundle = await bundleWorkflowCode({
  workflowsPath: new URL("../build/worker/src/temporal/workflows.js", import.meta.url).pathname,
});
await writeFile(new URL("../build/worker/workflow-bundle.js", import.meta.url), bundle.code);
