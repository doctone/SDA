create table if not exists hiring_threads (
  id bigint primary key,
  title text not null,
  posted_by text not null,
  posted_at timestamptz not null,
  reported_comment_count integer not null,
  first_fetched_at timestamptz not null default now(),
  last_fetched_at timestamptz not null default now()
);

create table if not exists ingestion_runs (
  workflow_id text not null,
  run_id text not null,
  thread_id bigint not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  total_comments integer,
  processed_comments integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (workflow_id, run_id)
);

create index if not exists ingestion_runs_thread_idx on ingestion_runs (thread_id, started_at desc);

create table if not exists comments (
  id bigint primary key,
  thread_id bigint not null references hiring_threads (id),
  author text,
  posted_at timestamptz,
  text_html text,
  text_plain text,
  content_hash text,
  is_deleted boolean not null default false,
  is_dead boolean not null default false,
  eligibility text not null check (eligibility in ('posting', 'not_posting', 'excluded')),
  eligibility_reason text not null,
  first_fetched_at timestamptz not null default now(),
  last_fetched_at timestamptz not null default now(),
  text_changed_at timestamptz
);

create index if not exists comments_thread_idx on comments (thread_id, eligibility);

create table if not exists skill_mentions (
  id bigserial primary key,
  comment_id bigint not null references comments (id) on delete cascade,
  skill_key text not null,
  mention_class text not null check (mention_class in ('requested', 'preferred', 'stack', 'header', 'unclassified')),
  excerpt text not null,
  extraction_version text not null,
  extracted_at timestamptz not null default now()
);

create index if not exists skill_mentions_comment_idx on skill_mentions (comment_id, extraction_version);
create index if not exists skill_mentions_skill_idx on skill_mentions (skill_key, mention_class);
