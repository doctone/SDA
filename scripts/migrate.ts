import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { readEnv } from "../src/lib/env";

async function migrate(): Promise<void> {
  const sql = postgres(readEnv().DATABASE_URL, { max: 1 });
  const schema = readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  await sql.unsafe(schema);
  await sql.end();
  console.log("schema applied");
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
