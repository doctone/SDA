#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
PROJECT="sda-verify"
WEB_URL="http://localhost:3100"
EVIDENCE_ROOT="$REPO_ROOT/.verify-evidence"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

compose() {
  docker compose -p "$PROJECT" -f "$REPO_ROOT/docker-compose.yml" -f "$SKILL_DIR/compose.verify.yml" "$@"
}

psql_skills() {
  compose exec -T postgres psql -U skills -d skills -v ON_ERROR_STOP=1 "$@"
}

usage() {
  cat <<'USAGE'
usage: verify-sda.sh <command> [args]

  up                         build and start the isolated stack, wait until the web app answers
  doctor                     read-only health check; exit 1 if the instance is not worth driving
  evidence-dir <feature-id>  create and print a fresh evidence directory
  db <thread-id> <dir>       write ingestion_runs, comment and skill_mentions rows for a thread to <dir>
  wait-run <thread-id> [s]   wait (default 240s) until the thread's latest run is not running; print its status
  screenshot <path> <png>    headless Chrome screenshot of http://localhost:3100<path>
  down                       remove the isolated stack and its volumes; evidence is kept
USAGE
}

wait_for_web() {
  local deadline=$((SECONDS + ${1:-300}))
  while ((SECONDS < deadline)); do
    if curl -fsS "$WEB_URL/" 2>/dev/null | grep "<title>HN skills demand</title>" >/dev/null; then
      return 0
    fi
    sleep 3
  done
  echo "web app did not answer at $WEB_URL within the timeout" >&2
  compose logs web --tail 40 >&2
  return 1
}

cmd_up() {
  if compose ps --status running --quiet | grep . >/dev/null; then
    echo "project $PROJECT is already running; run doctor, or down before a fresh up" >&2
    exit 1
  fi
  if lsof -nP -iTCP:3100 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port 3100 is in use by something outside $PROJECT; refusing to start" >&2
    exit 1
  fi
  compose up -d --build -V
  wait_for_web 300
  echo "ready: $WEB_URL"
}

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "ok    $label"
  else
    echo "FAIL  $label"
    failures=$((failures + 1))
  fi
}

service_running() {
  compose ps --status running --services | grep -x "$1" >/dev/null
}

migrate_succeeded() {
  compose ps -a --format '{{.Service}} {{.State}} {{.ExitCode}}' | grep -x "migrate exited 0" >/dev/null
}

port_owned_by_project() {
  compose port web 3000 | grep ":3100$" >/dev/null
}

web_answers() {
  curl -fsS "$WEB_URL/" | grep "<title>HN skills demand</title>" >/dev/null
}

schema_present() {
  psql_skills -tAc "select count(*) from ingestion_runs"
}

worker_polling() {
  compose logs worker | grep "state: 'RUNNING'" >/dev/null
}

hn_reachable_from_worker() {
  compose exec -T worker node -e "fetch('https://hacker-news.firebaseio.com/v0/maxitem.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
}

cmd_doctor() {
  failures=0
  for service in postgres temporal worker web; do
    check "service $service running in $PROJECT" service_running "$service"
  done
  check "migrate job exited 0" migrate_succeeded
  check "port 3100 published by $PROJECT web" port_owned_by_project
  check "GET $WEB_URL/ returns the SDA app" web_answers
  check "skills database has the app schema" schema_present
  check "worker reached RUNNING on its task queue" worker_polling
  check "worker can reach the HN API" hn_reachable_from_worker
  local dirty=""
  git -C "$REPO_ROOT" diff --quiet HEAD -- || dirty=" (uncommitted changes are live: source is bind-mounted)"
  echo "info  source $(git -C "$REPO_ROOT" rev-parse --short HEAD) on $(git -C "$REPO_ROOT" branch --show-current)$dirty"
  echo "info  runs in this instance: $(psql_skills -tAc 'select count(*) from ingestion_runs' 2>/dev/null || echo '?')"
  if ((failures > 0)); then
    echo "doctor: $failures check(s) failed" >&2
    exit 1
  fi
  echo "doctor: healthy"
}

cmd_evidence_dir() {
  local feature="${1:?feature id required}"
  local dir
  dir="$EVIDENCE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)-$feature"
  mkdir -p "$dir"
  echo "$dir"
}

cmd_db() {
  local thread="${1:?thread id required}" dir="${2:?evidence dir required}"
  [[ "$thread" =~ ^[0-9]+$ ]] || { echo "thread id must be numeric" >&2; exit 1; }
  mkdir -p "$dir"
  psql_skills -c "select workflow_id, run_id, thread_id, status, total_comments, processed_comments, error, started_at, finished_at from ingestion_runs where thread_id = $thread order by started_at" >"$dir/ingestion_runs.txt"
  psql_skills -c "select eligibility, count(*) from comments where thread_id = $thread group by eligibility order by eligibility" >"$dir/comments_by_eligibility.txt"
  psql_skills -c "select m.skill_key, m.mention_class, count(*) as mentions, count(distinct m.comment_id) as postings from skill_mentions m join comments c on c.id = m.comment_id where c.thread_id = $thread and c.eligibility = 'posting' group by 1, 2 order by 1, 2" >"$dir/skill_mentions_summary.txt"
  psql_skills -c "select m.comment_id, c.author, m.skill_key, m.mention_class, m.extraction_version, m.excerpt from skill_mentions m join comments c on c.id = m.comment_id where c.thread_id = $thread order by m.skill_key, m.comment_id, m.id" >"$dir/skill_mentions.txt"
  wc -l "$dir"/*.txt
}

cmd_wait_run() {
  local thread="${1:?thread id required}" timeout="${2:-240}"
  [[ "$thread" =~ ^[0-9]+$ ]] || { echo "thread id must be numeric" >&2; exit 1; }
  local deadline=$((SECONDS + timeout)) status=""
  while ((SECONDS < deadline)); do
    status="$(psql_skills -tAc "select status from ingestion_runs where thread_id = $thread order by started_at desc limit 1")"
    if [[ -n "$status" && "$status" != "running" ]]; then
      echo "$status"
      return 0
    fi
    sleep 3
  done
  echo "timed out with status '${status:-none}'" >&2
  return 1
}

cmd_screenshot() {
  local path="${1:?url path required, e.g. /threads/1}" out="${2:?output png required}"
  [[ -x "$CHROME" ]] || { echo "Google Chrome not found at $CHROME" >&2; exit 1; }
  mkdir -p "$(dirname "$out")"
  local profile
  profile="$(mktemp -d)"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$profile" \
    --window-size=1280,1600 --virtual-time-budget=8000 --screenshot="$out" "$WEB_URL$path" >/dev/null 2>&1
  rm -rf "$profile"
  [[ -s "$out" ]] || { echo "screenshot was not written" >&2; exit 1; }
  echo "$out"
}

cmd_down() {
  compose down -v --remove-orphans
  echo "removed $PROJECT; evidence kept in $EVIDENCE_ROOT"
}

case "${1:-}" in
  up) cmd_up ;;
  doctor) cmd_doctor ;;
  evidence-dir) shift; cmd_evidence_dir "$@" ;;
  db) shift; cmd_db "$@" ;;
  wait-run) shift; cmd_wait_run "$@" ;;
  screenshot) shift; cmd_screenshot "$@" ;;
  down) cmd_down ;;
  *) usage; exit 1 ;;
esac
