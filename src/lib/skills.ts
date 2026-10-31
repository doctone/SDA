export type SkillDefinition = {
  key: string;
  label: string;
  pattern: RegExp;
};

const word = (source: string, flags = "i") => new RegExp(`(?<![\\w.+#-])(?:${source})(?![\\w+#-])`, `${flags}g`);

export const SKILLS: readonly SkillDefinition[] = [
  { key: "typescript", label: "TypeScript", pattern: word("typescript") },
  { key: "javascript", label: "JavaScript", pattern: word("javascript") },
  { key: "python", label: "Python", pattern: word("python") },
  { key: "rust", label: "Rust", pattern: word("Rust", "") },
  { key: "go", label: "Go", pattern: word("Golang|Go(?=\\s*(?:[,/|)]|$|\\band\\b|\\bor\\b))", "") },
  { key: "java", label: "Java", pattern: word("java(?!script)") },
  { key: "cpp", label: "C++", pattern: word("c\\+\\+") },
  { key: "csharp", label: "C#", pattern: word("c#|c-sharp") },
  { key: "ruby", label: "Ruby", pattern: word("ruby(?: on rails)?") },
  { key: "elixir", label: "Elixir", pattern: word("elixir") },
  { key: "kotlin", label: "Kotlin", pattern: word("kotlin") },
  { key: "swift", label: "Swift", pattern: word("Swift(?:UI)?", "") },
  { key: "react", label: "React", pattern: word("React(?:\\.js)?(?!\\s*Native)", "") },
  { key: "react-native", label: "React Native", pattern: word("react native") },
  { key: "nextjs", label: "Next.js", pattern: word("next\\.?js") },
  { key: "nodejs", label: "Node.js", pattern: word("node\\.?js") },
  { key: "vue", label: "Vue", pattern: word("vue(?:\\.js)?") },
  { key: "angular", label: "Angular", pattern: word("angular") },
  { key: "django", label: "Django", pattern: word("django") },
  { key: "fastapi", label: "FastAPI", pattern: word("fastapi") },
  { key: "rails", label: "Rails", pattern: word("rails") },
  { key: "postgres", label: "Postgres", pattern: word("postgres(?:ql)?") },
  { key: "mysql", label: "MySQL", pattern: word("mysql") },
  { key: "mongodb", label: "MongoDB", pattern: word("mongodb|mongo") },
  { key: "redis", label: "Redis", pattern: word("redis") },
  { key: "kafka", label: "Kafka", pattern: word("kafka") },
  { key: "graphql", label: "GraphQL", pattern: word("graphql") },
  { key: "aws", label: "AWS", pattern: word("aws|amazon web services") },
  { key: "gcp", label: "Google Cloud", pattern: word("gcp|google cloud") },
  { key: "azure", label: "Azure", pattern: word("azure") },
  { key: "kubernetes", label: "Kubernetes", pattern: word("kubernetes|k8s") },
  { key: "docker", label: "Docker", pattern: word("docker") },
  { key: "terraform", label: "Terraform", pattern: word("terraform") },
  { key: "pytorch", label: "PyTorch", pattern: word("pytorch") },
  { key: "tensorflow", label: "TensorFlow", pattern: word("tensorflow") },
];

export const SKILL_LABELS: Record<string, string> = Object.fromEntries(SKILLS.map((skill) => [skill.key, skill.label]));
