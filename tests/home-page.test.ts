import type { Page } from "playwright";
import { describe, expect, it } from "vitest";
import { comment, hiringThread, NOVEMBER_THREAD_ID, novemberThread } from "./support/hn-fixtures";
import { hn, openPage } from "./support/harness";

async function submitThread(page: Page, value: string): Promise<void> {
  await page.getByLabel("HN thread ID or link").fill(value);
  await page.getByRole("button", { name: "Analyse thread" }).click();
}

function formError(page: Page) {
  return page.locator("form").getByRole("alert");
}

function recentRuns(page: Page) {
  return page.getByRole("listitem").getByRole("link");
}

describe("home page", () => {
  it("shows an empty state before any thread has been analysed", async () => {
    const page = await openPage("/");

    await page.getByText("No runs yet.").waitFor();
    expect(await page.getByRole("heading", { level: 1 }).textContent()).toBe("Skills demand from HN hiring threads");
  });

  it("asks for a thread when the input is empty", async () => {
    const page = await openPage("/");

    await submitThread(page, "   ");

    expect(await formError(page).textContent()).toBe("Enter an HN thread ID or link.");
  });

  it.each(["who is hiring", "https://example.com/item?id=1000"])(
    "rejects %s and keeps what was typed",
    async (input) => {
      const page = await openPage("/");

      await submitThread(page, input);

      expect(await formError(page).textContent()).toBe(
        "Use a numeric HN item ID or a news.ycombinator.com/item?id=… link.",
      );
      expect(await page.getByLabel("HN thread ID or link").inputValue()).toBe(input);
      expect(new URL(page.url()).pathname).toBe("/");
    },
  );

  it.each([String(NOVEMBER_THREAD_ID), `  https://news.ycombinator.com/item?id=${NOVEMBER_THREAD_ID}\n`])(
    "analyses the thread entered as %j and shows its results",
    async (input) => {
      await hn.publish(...novemberThread());
      const page = await openPage("/");

      await submitThread(page, input);

      await page.waitForURL(`/threads/${NOVEMBER_THREAD_ID}`);
      await page.getByText(/Last run completed/).waitFor();
      expect(await page.getByRole("heading", { level: 1 }).textContent()).toBe("Ask HN: Who is hiring? (November 2026)");
    },
  );

  it("lists recent runs with their status and progress, newest first", async () => {
    await hn.publish(...novemberThread(), { id: 2000, type: "story", by: "dang", title: "Ask HN: Who wants to be hired?" });
    const page = await openPage("/");
    await submitThread(page, String(NOVEMBER_THREAD_ID));
    await page.getByText(/Last run completed/).waitFor();
    await page.goto("/");
    await submitThread(page, "2000");
    await page.getByText("The last run failed").waitFor();

    await page.goto("/");

    await expect.poll(() => recentRuns(page).count(), { timeout: 10_000 }).toBe(2);
    const [failedRun, completedRun] = await recentRuns(page).all();
    expect(await failedRun.textContent()).toContain("HN item 2000");
    expect(await failedRun.textContent()).toContain("Failed");
    expect(await failedRun.textContent()).toContain("HN item 2000 is not a hiring thread: posted by dang, not whoishiring");
    expect(await completedRun.textContent()).toContain("Ask HN: Who is hiring? (November 2026)");
    expect(await completedRun.textContent()).toContain("7 of 7 comments");
    expect(await completedRun.textContent()).toContain("Completed");

    await completedRun.click();
    await page.waitForURL(`/threads/${NOVEMBER_THREAD_ID}`);
  });

  it("updates a running run in the list without a reload", async () => {
    const postings = Array.from({ length: 30 }, (_, index) =>
      comment(1101 + index, NOVEMBER_THREAD_ID, `employer${index}`, `Employer ${index} | Engineer | Remote<p>You have experience with Python.`),
    );
    await hn.publish(hiringThread(NOVEMBER_THREAD_ID, postings), ...postings);
    await hn.hold(postings[25].id);
    const page = await openPage("/");
    await submitThread(page, String(NOVEMBER_THREAD_ID));
    await page.waitForURL(`/threads/${NOVEMBER_THREAD_ID}`);

    await page.goto("/");

    const run = recentRuns(page).first();
    await expect.poll(() => run.textContent(), { timeout: 20_000 }).toContain("25 of 30 comments");
    expect(await run.textContent()).toContain("Running");

    await hn.release();

    await expect.poll(() => run.textContent(), { timeout: 20_000 }).toContain("30 of 30 comments");
    expect(await run.textContent()).toContain("Completed");
  });
});
