#!/bin/sh
set -eu

tool() {
  temporal-sql-tool --plugin postgres12 --ep "$POSTGRES_SEEDS" -u "$POSTGRES_USER" -p "${DB_PORT:-5432}" "$@"
}

setup_database() {
  database="$1"
  schema_dir="$2"
  if tool --db "$database" update-schema -d "$schema_dir" 2>/dev/null; then
    echo "$database already initialised, schema updated"
    return
  fi
  tool --db "$database" create
  tool --db "$database" setup-schema -v 0.0
  tool --db "$database" update-schema -d "$schema_dir"
  echo "$database created"
}

setup_database temporal /etc/temporal/schema/postgresql/v12/temporal/versioned
setup_database temporal_visibility /etc/temporal/schema/postgresql/v12/visibility/versioned
