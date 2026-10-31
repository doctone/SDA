import { afterEach, expect, test, vi } from "vitest";
import { readEnv } from "../src/lib/env";
import { temporalConnectionOptions } from "../src/temporal/connection";
import { startIngestion } from "../src/temporal/client";

afterEach(() => vi.unstubAllEnvs());

test("Cloud credentials enable TLS for both SDK connection types", () => {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  vi.stubEnv("TEMPORAL_ADDRESS", "example.tmprl.cloud:7233");
  vi.stubEnv("TEMPORAL_API_KEY", "test-key");
  expect(temporalConnectionOptions(readEnv())).toEqual({
    address: "example.tmprl.cloud:7233",
    tls: true,
    apiKey: "test-key",
  });
});

test("local connections omit Cloud authentication and empty keys are rejected", () => {
  vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
  vi.stubEnv("TEMPORAL_ADDRESS", "localhost:7233");
  vi.stubEnv("TEMPORAL_API_KEY", undefined);
  expect(temporalConnectionOptions(readEnv())).toEqual({ address: "localhost:7233" });
  vi.stubEnv("TEMPORAL_API_KEY", "");
  expect(() => readEnv()).toThrow();
});

test("preview ingestion is rejected before any connection or workflow is created", async () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("DATABASE_URL", undefined);
  await expect(startIngestion(123)).rejects.toThrow("Ingestion is disabled in preview deployments.");
});
