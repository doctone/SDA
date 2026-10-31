import type { Env } from "../lib/env";

export function temporalConnectionOptions(env: Pick<Env, "TEMPORAL_ADDRESS" | "TEMPORAL_API_KEY">) {
  return {
    address: env.TEMPORAL_ADDRESS,
    ...(env.TEMPORAL_API_KEY ? { tls: true, apiKey: env.TEMPORAL_API_KEY } : {}),
  };
}
