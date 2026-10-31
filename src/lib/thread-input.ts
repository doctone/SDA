import { z } from "zod";

export type ThreadInputResult = { ok: true; threadId: number } | { ok: false; message: string };

const itemIdSchema = z.coerce.number().int().positive();

const HN_HOSTS = new Set(["news.ycombinator.com", "ycombinator.com"]);

function readIdFromUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!HN_HOSTS.has(url.hostname) || url.pathname !== "/item") {
    return null;
  }
  return url.searchParams.get("id");
}

export function parseThreadInput(raw: string): ThreadInputResult {
  const value = raw.trim();
  if (value === "") {
    return { ok: false, message: "Enter an HN thread ID or link." };
  }
  const candidate = /^\d+$/.test(value) ? value : readIdFromUrl(value);
  const parsed = itemIdSchema.safeParse(candidate);
  if (candidate === null || !parsed.success) {
    return { ok: false, message: "Use a numeric HN item ID or a news.ycombinator.com/item?id=… link." };
  }
  return { ok: true, threadId: parsed.data };
}
