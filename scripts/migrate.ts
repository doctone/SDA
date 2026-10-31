import postgres from "postgres";
import { readEnv } from "../src/lib/env";
import { applyMigrations } from "./db-migrations";

async function migrate(): Promise<void> {
  const sql = postgres(readEnv().DATABASE_URL, { max: 1 });
  try {
    await applyMigrations(sql);
  } finally {
    await sql.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
