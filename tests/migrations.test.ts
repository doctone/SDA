import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, expect, inject, test } from "vitest";
import { applyMigrations } from "../scripts/db-migrations";

const sql = postgres(inject("databaseUrl"), { max: 1, connection: { search_path: "migration_test" }, onnotice: () => {} });
let directory: string;
beforeEach(async () => {
  await sql`create schema migration_test`;
  directory = mkdtempSync(path.join(tmpdir(), "sda-migrations-"));
  mkdirSync(path.join(directory, "migrations"));
  writeFileSync(path.join(directory, "schema.sql"), "create table if not exists example (id integer primary key);");
});
afterEach(async () => {
  await sql`drop schema migration_test cascade`;
  rmSync(directory, { recursive: true });
});

const add = (name: string, source: string) => writeFileSync(path.join(directory, "migrations", name), source);

test("upgrades an existing database, preserves rows, and applies each change once", async () => {
  await sql.unsafe(readFileSync(path.join(directory, "schema.sql"), "utf8"));
  await sql`insert into example values (1)`;
  add("0001_name.sql", "alter table example add column name text default 'retained';");
  await applyMigrations(sql, directory);
  await applyMigrations(sql, directory);
  expect(await sql`select * from example`).toEqual([{ id: 1, name: "retained" }]);
  expect(await sql`select name from schema_migrations`).toHaveLength(2);
});

test("rolls back schema and ledger on failure, then retries successfully", async () => {
  await applyMigrations(sql, directory);
  add("0001_name.sql", "alter table example add column name text;");
  add("0002_invalid.sql", "select * from nonexistent_table;");
  await expect(applyMigrations(sql, directory)).rejects.toThrow();
  expect(await sql`select name from schema_migrations`).toHaveLength(1);
  await expect(sql`select name from example`).rejects.toThrow();
  add("0002_invalid.sql", "insert into example (id, name) values (1, 'retry');");
  await applyMigrations(sql, directory);
  expect(await sql`select * from example`).toEqual([{ id: 1, name: "retry" }]);
});

test("rejects edits to an applied migration", async () => {
  await applyMigrations(sql, directory);
  writeFileSync(path.join(directory, "schema.sql"), "select 1;");
  await expect(applyMigrations(sql, directory)).rejects.toThrow("changed or removed");
});

test("serializes concurrent migration runners", async () => {
  const other = postgres(inject("databaseUrl"), { max: 1, connection: { search_path: "migration_test" }, onnotice: () => {} });
  try {
    add("0001_name.sql", "alter table example add column name text;");
    await Promise.all([applyMigrations(sql, directory), applyMigrations(other, directory)]);
    expect(await sql`select name from schema_migrations`).toHaveLength(2);
  } finally {
    await other.end();
  }
});

afterAll(() => sql.end());
