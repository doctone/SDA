import type { HnItem } from "./hn";
import { HIRING_ACCOUNT, hnHtmlToPlainText } from "./hn";
import { SKILLS } from "./skills";

export const EXTRACTION_VERSION = "v1";

export type Eligibility = "posting" | "not_posting" | "excluded";

export type EligibilityDecision = {
  eligibility: Eligibility;
  reason: string;
};

export function decideEligibility(item: HnItem, threadId: number): EligibilityDecision {
  if (item.deleted) {
    return { eligibility: "excluded", reason: "comment deleted" };
  }
  if (item.dead) {
    return { eligibility: "excluded", reason: "comment flagged dead" };
  }
  if (item.parent !== threadId) {
    return { eligibility: "excluded", reason: "not a top-level comment of this thread" };
  }
  if (item.by === HIRING_ACCOUNT) {
    return { eligibility: "excluded", reason: "posted by the thread account" };
  }
  const text = hnHtmlToPlainText(item.text ?? "");
  if (text.length === 0) {
    return { eligibility: "excluded", reason: "empty text" };
  }
  const firstLine = text.split("\n")[0] ?? "";
  if (!firstLine.includes("|")) {
    return { eligibility: "not_posting", reason: "first line has no | separated header" };
  }
  return { eligibility: "posting", reason: "top-level comment with | separated header" };
}

export type MentionClass = "requested" | "preferred" | "stack" | "header" | "unclassified";

export type SkillMention = {
  skillKey: string;
  mentionClass: MentionClass;
  excerpt: string;
};

const REQUESTED_CUES =
  /\b(must have|must be|required|requirements?|experience (with|in|using|building|of)|years? of|proficien\w*|familiar(ity)? with|strong\b.{0,40}\b(skills?|background|experience|knowledge)|looking for|we want|you have|you've|you should|you are|you're|ideal candidate|expertise (in|with)|fluent in|comfortable with|deep (knowledge|understanding)|solid understanding|background in|hands-on|we need|need someone|should have|should be|love|know(s|ledge of)?)\b/i;

const PREFERRED_CUES = /\b(nice to have|nice-to-have|bonus|a plus|big plus|plus if|preferred|ideally|not required|optional|helpful)\b/i;

const STACK_CUES =
  /\b(tech stack|our stack|stack:|technologies|tech we use|we use|we're using|we are using|built (with|in|on|using)|written in|runs on|powered by|we're building|we are building|codebase|infrastructure is|backend is|frontend is|primarily)\b|\bstack\b/i;

export function splitSegments(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z*\-•])/))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function classifySegment(segment: string, isHeader: boolean): MentionClass {
  if (isHeader) {
    return "header";
  }
  if (PREFERRED_CUES.test(segment)) {
    return "preferred";
  }
  if (REQUESTED_CUES.test(segment)) {
    return "requested";
  }
  if (STACK_CUES.test(segment)) {
    return "stack";
  }
  return "unclassified";
}

const EXCERPT_LIMIT = 300;

function toExcerpt(segment: string): string {
  return segment.length > EXCERPT_LIMIT ? `${segment.slice(0, EXCERPT_LIMIT - 1)}…` : segment;
}

export function extractSkillMentions(plainText: string): SkillMention[] {
  const segments = splitSegments(plainText);
  const mentions: SkillMention[] = [];
  segments.forEach((segment, index) => {
    const isHeader = index === 0 && segment.includes("|");
    const mentionClass = classifySegment(segment, isHeader);
    for (const skill of SKILLS) {
      skill.pattern.lastIndex = 0;
      if (skill.pattern.test(segment)) {
        mentions.push({ skillKey: skill.key, mentionClass, excerpt: toExcerpt(segment) });
      }
    }
  });
  return mentions;
}
