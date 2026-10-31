import type { Page } from "playwright";
import { describe, expect, it } from "vitest";
import { acmePosting, comment, hiringThread, NOVEMBER_THREAD_ID, novemberThread } from "./support/hn-fixtures";
import { hn, openPage } from "./support/harness";

const threadPath = `/threads/${NOVEMBER_THREAD_ID}`;

async function waitForCompletedRun(page: Page): Promise<void> {
  await page.getByText(/Last run completed/).waitFor({ timeout: 30_000 });
}

async function analyseNovemberThread(): Promise<Page> {
  await hn.publish(...novemberThread());
  const page = await openPage(threadPath);
  await page.getByRole("button", { name: "Analyse thread" }).click();
  await waitForCompletedRun(page);
  return page;
}

function skillRow(page: Page, label: string) {
  return page.getByRole("link", { name: new RegExp(`^[▸▾]\\s*${label}\\b`) });
}

async function readSkillTable(page: Page): Promise<string[][]> {
  const rows = await page.locator("a[aria-expanded]").all();
  return Promise.all(rows.map(async (row) => (await row.innerText()).split("\n").map((cell) => cell.replace(/^[▸▾]\s*/, "").trim())));
}

async function readCommentCounts(page: Page): Promise<Record<string, string>> {
  const labels = await page.locator("dt").allInnerTexts();
  const values = await page.locator("dd").allInnerTexts();
  return Object.fromEntries(labels.map((label, index) => [label, values[index]]));
}

describe("thread page", () => {
  it("offers to analyse a thread that has never been run", async () => {
    await hn.publish(...novemberThread());
    const page = await openPage(threadPath);

    await page.getByRole("heading", { name: `HN item ${NOVEMBER_THREAD_ID} has not been analysed` }).waitFor();
    await page.getByRole("button", { name: "Analyse thread" }).click();

    await waitForCompletedRun(page);
    expect(await page.getByRole("heading", { level: 1 }).textContent()).toBe("Ask HN: Who is hiring? (November 2026)");
  });

  it("counts eligible postings, discussion and removed comments", async () => {
    const page = await analyseNovemberThread();

    expect(await readCommentCounts(page)).toEqual({
      "Eligible postings": "3",
      "Top-level comments": "7",
      "Discussion, not a posting": "1",
      "Deleted, dead or empty": "3",
    });
    expect(await page.getByText(/Last run completed/).textContent()).toContain("7 comments processed");
    expect(await page.getByRole("link", { name: "View on HN" }).getAttribute("href")).toBe(
      `https://news.ycombinator.com/item?id=${NOVEMBER_THREAD_ID}`,
    );
  });

  it("ranks skills by how many postings ask for them, separate from stack and header mentions", async () => {
    const page = await analyseNovemberThread();

    expect(await readSkillTable(page)).toEqual([
      ["Postgres", "1 · 33%", "1", "0", "2"],
      ["Python", "1 · 33%", "1", "0", "2"],
      ["Go", "1 · 33%", "1", "0", "1"],
      ["Kafka", "1 · 33%", "1", "0", "1"],
      ["React", "1 · 33%", "1", "0", "1"],
      ["Rust", "1 · 33%", "0", "1", "1"],
      ["TypeScript", "1 · 33%", "1", "0", "1"],
      ["Elixir", "0 · 0%", "0", "0", "1"],
      ["JavaScript", "0 · 0%", "0", "0", "1"],
      ["Kubernetes", "0 · 0%", "0", "0", "1"],
    ]);
  });

  it("shows the excerpts behind a skill and hides them again", async () => {
    const page = await analyseNovemberThread();

    await skillRow(page, "Python").click();

    await page.waitForURL(`${threadPath}?skill=python`);
    const excerpts = page.getByRole("listitem").getByRole("listitem");
    await excerpts.first().waitFor();
    const excerptLines = (await excerpts.allInnerTexts()).map((text) => text.split("\n").filter((line) => line.length > 0));
    expect(excerptLines).toEqual([
      ["Required", "globex_hr on HN ↗", "Must have experience with Python."],
      ["Stack", "acme_jobs on HN ↗", "Stack: Python, Postgres, Kubernetes."],
    ]);
    expect(await excerpts.locator("mark").allInnerTexts()).toEqual(["Python", "Python"]);
    expect(await excerpts.first().getByRole("link").getAttribute("href")).toBe("https://news.ycombinator.com/item?id=1002");
    expect(await skillRow(page, "Python").getAttribute("aria-expanded")).toBe("true");

    await skillRow(page, "Python").click();

    await page.waitForURL(threadPath);
    await expect.poll(() => excerpts.count()).toBe(0);
    expect(await skillRow(page, "Python").getAttribute("aria-expanded")).toBe("false");
  });

  it("shows progress while comments are fetched, then the results without a reload", async () => {
    const postings = Array.from({ length: 30 }, (_, index) =>
      comment(1101 + index, NOVEMBER_THREAD_ID, `employer${index}`, `Employer ${index} | Engineer | Remote<p>You have experience with Python.`),
    );
    await hn.publish(hiringThread(NOVEMBER_THREAD_ID, postings), ...postings);
    await hn.hold(postings[25].id);
    const page = await openPage(threadPath);

    await page.getByRole("button", { name: "Analyse thread" }).click();

    const banner = page.getByRole("status");
    await expect.poll(() => banner.textContent(), { timeout: 20_000 }).toContain("Processing comments: 25 of 30");
    expect(await banner.textContent()).toContain("Running");
    expect(await page.getByRole("button", { name: "Run again" }).count()).toBe(0);

    await hn.release();

    await waitForCompletedRun(page);
    expect(await readSkillTable(page)).toEqual([["Python", "30 · 100%", "30", "0", "30"]]);
  });

  it("picks up edited postings when run again without double counting", async () => {
    const page = await analyseNovemberThread();
    await hn.publish({ ...acmePosting, text: `${acmePosting.text}<p>Experience with Kotlin is required.` });

    await page.getByRole("button", { name: "Run again" }).click();

    await expect.poll(() => readSkillTable(page), { timeout: 30_000 }).toContainEqual(["Kotlin", "1 · 33%", "1", "0", "1"]);
    await waitForCompletedRun(page);
    expect(await readCommentCounts(page)).toMatchObject({ "Eligible postings": "3", "Top-level comments": "7" });
    expect(await readSkillTable(page)).toContainEqual(["Postgres", "1 · 33%", "1", "0", "2"]);
  });

  it("explains why a thread that is not a hiring thread failed", async () => {
    await hn.publish({ id: 2000, type: "story", by: "dang", title: "Ask HN: Who wants to be hired?" });
    const page = await openPage("/threads/2000");

    await page.getByRole("button", { name: "Analyse thread" }).click();

    const failure = page.getByRole("alert").filter({ hasText: "The last run failed" });
    await failure.waitFor({ timeout: 30_000 });
    expect(await failure.textContent()).toContain("HN item 2000 is not a hiring thread: posted by dang, not whoishiring");
    expect(await failure.textContent()).toContain("No data has been stored for this thread.");
    await page.getByRole("button", { name: "Run again" }).waitFor();
  });

  it("explains that an HN item does not exist", async () => {
    const page = await openPage("/threads/3000");

    await page.getByRole("button", { name: "Analyse thread" }).click();

    const failure = page.getByRole("alert").filter({ hasText: "The last run failed" });
    await failure.waitFor({ timeout: 30_000 });
    expect(await failure.textContent()).toContain("HN item 3000 does not exist");
  });

  it.each(["abc", "-5", "1.5"])("shows not found for the thread id %s", async (id) => {
    const page = await openPage(`/threads/${id}`);

    await page.getByText("This page could not be found.").waitFor();
  });
});
