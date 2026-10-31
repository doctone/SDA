import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type postgres from "postgres";

export async function applyMigrations(sql: postgres.Sql, directory = path.join(process.cwd(), "db")): Promise<void> {
  const files = ["schema.sql", ...readdirSync(path.join(directory, "migrations")).filter((name) => name.endsWith(".sql")).sort().map((name) => `migrations/${name}`)];
  const migrations = files.map((name) => {
    const source = readFileSync(path.join(directory, name), "utf8");
    return { name, source, checksum: createHash("sha256").update(source).digest("hex") };
  });
  await sql.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(736321004)`;
    await transaction`create table if not exists schema_migrations (
      name text primary key, checksum text not null, applied_at timestamptz not null default now()
    )`;
    const applied = await transaction<{ name: string; checksum: string }[]>`select name, checksum from schema_migrations order by name`;
    for (const previous of applied) {
      if (!migrations.some((migration) => migration.name === previous.name && migration.checksum === previous.checksum)) {
        throw new Error(`Applied migration was changed or removed: ${previous.name}`);
      }
    }
    for (const migration of migrations) {
      if (applied.some((previous) => previous.name === migration.name)) continue;
      if (migration.name !== "schema.sql" && applied.some((previous) => previous.name !== "schema.sql" && previous.name > migration.name)) {
        throw new Error(`Migration must follow existing migrations: ${migration.name}`);
      }
      await transaction.unsafe(migration.source);
      await transaction`insert into schema_migrations (name, checksum) values (${migration.name}, ${migration.checksum})`;
    }
  });
}
