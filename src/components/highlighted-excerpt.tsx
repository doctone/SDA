import { SKILLS } from "@/lib/skills";

export function HighlightedExcerpt({ text, skillKey }: { text: string; skillKey: string }) {
  const skill = SKILLS.find((candidate) => candidate.key === skillKey);
  if (!skill) {
    return <>{text}</>;
  }
  const splitter = new RegExp(`(${skill.pattern.source})`, skill.pattern.flags);
  const parts = text.split(splitter);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="rounded bg-orange-100 px-0.5 font-medium text-orange-900">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
