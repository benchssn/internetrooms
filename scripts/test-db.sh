#!/usr/bin/env bash
# Runs the database security tests against a throwaway local PostgreSQL:
#   1. starts a temporary server (no data outside a temp directory)
#   2. loads a minimal Supabase emulation (roles, auth.uid(), storage)
#   3. applies every migration in supabase/migrations TWICE (idempotency)
#   4. runs supabase/tests/rls.test.sql, which fails on the first broken
#      expectation
# Needs PostgreSQL server binaries (initdb, pg_ctl) — e.g. the
# postgresql-16 package. Never touches a real Supabase project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)}"
if [ -z "${PGBIN}" ] || [ ! -x "${PGBIN}/initdb" ]; then
  echo "test:db needs PostgreSQL server binaries (initdb, pg_ctl). Set PGBIN or install postgresql." >&2
  exit 1
fi

WORK="$(mktemp -d)"
PORT="${TEST_DB_PORT:-54329}"
RUN=()
if [ "$(id -u)" = "0" ]; then
  # PostgreSQL refuses to run as root.
  chown postgres "$WORK"
  RUN=(runuser -u postgres --)
fi

cleanup() {
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -l "$WORK/server.log" -w \
  -o "-p $PORT -k $WORK -c listen_addresses=''" start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase_emulation.sql"
for pass in 1 2; do
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    "${PSQL[@]}" -f "$migration"
  done
done
echo "Migrations applied twice without errors."

# Query results are discarded; each check reports through a NOTICE.
"${PSQL[@]}" -o /dev/null -f "$ROOT/supabase/tests/rls.test.sql" 2>&1 \
  | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR):  /\1: /; s/^NOTICE: //'
exit "${PIPESTATUS[0]}"
