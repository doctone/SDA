import { z } from "zod";
import { readEnv } from "./env";

export const HIRING_ACCOUNT = "whoishiring";
const HIRING_TITLE = /^Ask HN: Who is hiring\?/i;

export const hnItemSchema = z.object({
  id: z.number().int(),
  type: z.string().optional(),
  by: z.string().optional(),
  time: z.number().int().optional(),
  text: z.string().optional(),
  title: z.string().optional(),
  parent: z.number().int().optional(),
  kids: z.array(z.number().int()).optional(),
  descendants: z.number().int().optional(),
  deleted: z.boolean().optional(),
  dead: z.boolean().optional(),
});

export type HnItem = z.infer<typeof hnItemSchema>;

export async function fetchHnItem(id: number): Promise<HnItem | null> {
  const response = await fetch(`${readEnv().HN_API_URL}/item/${id}.json`);
  if (!response.ok) {
    throw new Error(`HN API returned ${response.status} for item ${id}`);
  }
  const body: unknown = await response.json();
  if (body === null) {
    return null;
  }
  return hnItemSchema.parse(body);
}

export function hnItemUrl(id: number): string {
  return `https://news.ycombinator.com/item?id=${id}`;
}

export type HiringThreadCheck =
  | { isHiringThread: true }
  | { isHiringThread: false; reason: string };

export function checkHiringThread(item: HnItem): HiringThreadCheck {
  if (item.type !== "story") {
    return { isHiringThread: false, reason: `item is a ${item.type ?? "unknown"}, not a story` };
  }
  if (item.by !== HIRING_ACCOUNT) {
    return { isHiringThread: false, reason: `posted by ${item.by ?? "unknown"}, not ${HIRING_ACCOUNT}` };
  }
  if (!item.title || !HIRING_TITLE.test(item.title)) {
    return { isHiringThread: false, reason: `title "${item.title ?? ""}" is not a Who is hiring thread` };
  }
  return { isHiringThread: true };
}

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    }
    return namedEntities[entity.toLowerCase()] ?? match;
  });
}

export function hnHtmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<p>/gi, "\n")
    .replace(/<\/p>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(stripped)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}
