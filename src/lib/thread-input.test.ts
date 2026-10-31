import { describe, expect, it } from "vitest";
import { parseThreadInput } from "./thread-input";

describe("parseThreadInput", () => {
  it("accepts a bare HN item id", () => {
    expect(parseThreadInput("49922569")).toEqual({ ok: true, threadId: 49922569 });
  });

  it("accepts an HN item URL", () => {
    expect(parseThreadInput("https://news.ycombinator.com/item?id=49922569")).toEqual({ ok: true, threadId: 49922569 });
  });

  it("ignores surrounding whitespace", () => {
    expect(parseThreadInput("  49922569\n")).toEqual({ ok: true, threadId: 49922569 });
  });

  it("rejects empty input", () => {
    expect(parseThreadInput("   ")).toEqual({ ok: false, message: "Enter an HN thread ID or link." });
  });

  it("rejects text that is not an id or HN link", () => {
    expect(parseThreadInput("who is hiring")).toEqual({
      ok: false,
      message: "Use a numeric HN item ID or a news.ycombinator.com/item?id=… link.",
    });
  });

  it("rejects links to other sites", () => {
    expect(parseThreadInput("https://example.com/item?id=49922569")).toMatchObject({ ok: false });
  });
});
