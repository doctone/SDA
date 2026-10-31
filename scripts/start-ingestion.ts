import { startIngestion } from "../src/temporal/client";

async function main(): Promise<void> {
  const threadId = Number(process.argv[2]);
  if (!Number.isInteger(threadId)) {
    console.error("usage: pnpm ingest <hn-thread-id>");
    process.exit(1);
  }
  console.log(JSON.stringify(await startIngestion(threadId)));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
