#!/usr/bin/env bash
# يشغّل اختبارات RLS على عنقود PostgreSQL مؤقت محلي (لا يتصل بأي قاعدة بعيدة أو إنتاجية).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "PostgreSQL server binaries not found (set PGBIN)"; exit 2; }

WORK="$(mktemp -d)"; PORT="${RLS_TEST_PORT:-55432}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || { echo "running as root requires a 'postgres' user"; exit 2; }
  chown postgres "$WORK"; RUN_AS=(runuser -u postgres --)
fi
cleanup() { "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust --locale=C.UTF-8 -E UTF8 >/dev/null
"${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -w start >/dev/null

export PGOPTIONS="-c client_min_messages=warning"
PSQL=("${RUN_AS[@]}" psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$HERE/auth-stub.sql"
for f in "$MIGRATIONS"/*.sql; do echo "apply: $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
# المخطط يجب أن يكون قابلًا لإعادة التنفيذ (idempotent) — باستثناء الـ trigger على auth.users المُعاد إنشاؤه.
for f in "$MIGRATIONS"/*.sql; do echo "re-apply: $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
PGOPTIONS="" "${PSQL[@]}" -t -A -f "$HERE/rls.test.sql" 2>&1 | sed "s/^psql:[^ ]* NOTICE:  /  /" | grep -v "^$"
PGOPTIONS="" "${PSQL[@]}" -t -A -v legacy_schema="$HERE/../legacy/v2_user_data.sql" -f "$HERE/legacy.test.sql" 2>&1 | sed "s/^psql:[^ ]* NOTICE:  /  /" | grep -v "^$" | grep -vE "^(CREATE|ALTER|REVOKE|GRANT|DROP|INSERT|SET|DO|RESET)" 
