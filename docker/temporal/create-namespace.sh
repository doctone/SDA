#!/bin/sh
set -eu

namespace="${DEFAULT_NAMESPACE:-default}"
attempt=1
until temporal operator cluster health --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; do
  if [ "$attempt" -ge 30 ]; then
    echo "Temporal server did not become healthy"
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if temporal operator namespace describe -n "$namespace" --address "$TEMPORAL_ADDRESS" >/dev/null 2>&1; then
  echo "namespace $namespace already exists"
else
  temporal operator namespace create -n "$namespace" --address "$TEMPORAL_ADDRESS"
  echo "namespace $namespace created"
fi
