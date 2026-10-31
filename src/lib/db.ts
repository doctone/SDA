import postgres from "postgres";
import { readEnv } from "./env";

export type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { skillsSql?: Sql };

export function getSql(): Sql {
  if (!globalForDb.skillsSql) {
    globalForDb.skillsSql = postgres(readEnv().DATABASE_URL, { max: 5 });
  }
  return globalForDb.skillsSql;
}
