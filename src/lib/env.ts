import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
  TEMPORAL_NAMESPACE: z.string().default("default"),
  TEMPORAL_TASK_QUEUE: z.string().default("hn-ingestion"),
  TEMPORAL_API_KEY: z.string().min(1).optional(),
  TEMPORAL_WORKFLOW_BUNDLE: z.string().min(1).optional(),
  HN_API_URL: z.string().url().default("https://hacker-news.firebaseio.com/v0"),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(): Env {
  return envSchema.parse(process.env);
}
