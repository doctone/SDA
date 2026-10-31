import type { HnItem } from "../../src/lib/hn";

const NOVEMBER_2026 = Date.UTC(2026, 10, 2, 15, 0) / 1000;

export function hiringThread(id: number, comments: HnItem[], overrides: Partial<HnItem> = {}): HnItem {
  return {
    id,
    type: "story",
    by: "whoishiring",
    time: NOVEMBER_2026,
    title: "Ask HN: Who is hiring? (November 2026)",
    kids: comments.map((comment) => comment.id),
    descendants: comments.length,
    ...overrides,
  };
}

export function comment(id: number, parent: number, by: string, text: string): HnItem {
  return { id, type: "comment", by, parent, time: NOVEMBER_2026 + 60, text };
}

export const NOVEMBER_THREAD_ID = 1000;

export const acmePosting = comment(
  1001,
  NOVEMBER_THREAD_ID,
  "acme_jobs",
  "Acme | Senior Engineer | Remote<p>Stack: Python, Postgres, Kubernetes.<p>You have strong experience with TypeScript and React.<p>Rust is a big plus.",
);

export function novemberThread(): HnItem[] {
  const comments: HnItem[] = [
    acmePosting,
    comment(
      1002,
      NOVEMBER_THREAD_ID,
      "globex_hr",
      "Globex | Backend Engineer (Elixir) | NYC<p>Our services are written in JavaScript.<p>Must have experience with Python.",
    ),
    comment(
      1003,
      NOVEMBER_THREAD_ID,
      "initech",
      "Initech | Platform Engineer | Berlin<p>You will go to conferences.<p>We need someone fluent in Go, Kafka and Postgres.",
    ),
    comment(1004, NOVEMBER_THREAD_ID, "reader", "Please add a remote tag to the template, it&#x27;d help a lot."),
    { id: 1005, parent: NOVEMBER_THREAD_ID, deleted: true },
    { ...comment(1006, NOVEMBER_THREAD_ID, "spammer", "Spam | Python | Remote<p>Must know Python."), dead: true },
  ];
  const missingCommentId = 1007;
  const kids = [...comments.map((item) => item.id), missingCommentId];
  return [hiringThread(NOVEMBER_THREAD_ID, comments, { kids }), ...comments];
}
