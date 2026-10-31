import { describe, expect, it } from "vitest";
import { decideEligibility, extractSkillMentions } from "./extraction";
import { hnHtmlToPlainText } from "./hn";

const THREAD_ID = 49922569;

describe("decideEligibility", () => {
  it("accepts a top-level comment with the pipe separated header", () => {
    const item = {
      id: 49925063,
      by: "somethingnew",
      parent: THREAD_ID,
      text: "Discord | Senior Software Engineer, Application Security | REMOTE (US West Coast)<p>Stack: Python primarily.",
    };
    expect(decideEligibility(item, THREAD_ID).eligibility).toBe("posting");
  });

  it("marks a discussion comment without a header as not a posting", () => {
    const item = {
      id: 49925643,
      by: "yboris",
      parent: THREAD_ID,
      text: "It&#x27;s my duty again to point out the popular request of including a <i>4DWW</i> tag in the description",
    };
    expect(decideEligibility(item, THREAD_ID)).toEqual({
      eligibility: "not_posting",
      reason: "first line has no | separated header",
    });
  });

  it("excludes deleted, dead and nested comments", () => {
    expect(decideEligibility({ id: 1, deleted: true, parent: THREAD_ID }, THREAD_ID).eligibility).toBe("excluded");
    expect(decideEligibility({ id: 2, dead: true, parent: THREAD_ID, text: "A | B" }, THREAD_ID).eligibility).toBe("excluded");
    expect(decideEligibility({ id: 3, parent: 49926618, text: "A | B" }, THREAD_ID).eligibility).toBe("excluded");
  });
});

describe("hnHtmlToPlainText", () => {
  it("turns paragraphs into lines and decodes entities", () => {
    expect(hnHtmlToPlainText("Rinse | Remote<p>We&#x27;re hiring &amp; <a href=\"x\">growing</a>.")).toBe(
      "Rinse | Remote\nWe're hiring & growing.",
    );
  });
});

describe("extractSkillMentions", () => {
  it("separates stack mentions from explicit requests in the Discord posting", () => {
    const text = hnHtmlToPlainText(
      "Discord | Senior Software Engineer, Application Security | REMOTE<p>Stack: Python primarily, some TypeScript/React, some Rust, occasional JavaScript. Runs on GCP.<p>Looking for: hands-on AppSec experience, comfort reading and writing code across languages.",
    );
    const mentions = extractSkillMentions(text);
    const classes = Object.fromEntries(mentions.map((m) => [m.skillKey, m.mentionClass]));
    expect(classes).toEqual({ python: "stack", typescript: "stack", react: "stack", rust: "stack", javascript: "stack", gcp: "stack" });
  });

  it("classifies the City Detect stack line and the big plus sentence separately", () => {
    const text = hnHtmlToPlainText(
      "City Detect | Full Stack Product Engineer | Tuscaloosa, AL<p>Stack: React/TypeScript, Python/FastAPI on AWS Lambda, Aurora PostgreSQL + PostGIS. Experience with Mapbox, deck.gl, Leaflet, D3, vector tiles/H3, or nation-scale OSM data is a big plus.",
    );
    const mentions = extractSkillMentions(text);
    expect(mentions.filter((m) => m.mentionClass === "stack").map((m) => m.skillKey).sort()).toEqual(
      ["aws", "fastapi", "postgres", "python", "react", "typescript"],
    );
    expect(mentions.some((m) => m.mentionClass === "preferred")).toBe(false);
  });

  it("marks skills in a requirement sentence as requested", () => {
    const text = hnHtmlToPlainText(
      "RINSE | REMOTE | Software Engineer<p>We're particularly interested in true full-stack engineers, with strong React / Typescript / CSS skills to complement our Python backend.",
    );
    const mentions = extractSkillMentions(text);
    expect(mentions.map((m) => [m.skillKey, m.mentionClass])).toEqual([
      ["typescript", "requested"],
      ["python", "requested"],
      ["react", "requested"],
    ]);
  });

  it("marks header mentions as header and does not match Java inside JavaScript", () => {
    const text = "River | Staff Engineers (Elixir) | NYC\nOur services are written in JavaScript.";
    const mentions = extractSkillMentions(text);
    expect(mentions).toEqual([
      { skillKey: "elixir", mentionClass: "header", excerpt: "River | Staff Engineers (Elixir) | NYC" },
      { skillKey: "javascript", mentionClass: "stack", excerpt: "Our services are written in JavaScript." },
    ]);
  });

  it("only matches Go as a language in list position", () => {
    expect(extractSkillMentions("You will go to conferences.").length).toBe(0);
    expect(extractSkillMentions("Stack: Go, Postgres, Kubernetes").map((m) => m.skillKey)).toEqual(["go", "postgres", "kubernetes"]);
  });

  it("leaves sentences without cues unclassified", () => {
    const mentions = extractSkillMentions("Acme | Engineer | Remote\nPlenty of Rust in the codebase and the team likes Postgres.\nThe office has a Rust sculpture.");
    expect(mentions.find((m) => m.excerpt.includes("sculpture"))?.mentionClass).toBe("unclassified");
  });
});
