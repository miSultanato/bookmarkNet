#!/bin/bash
set -euo pipefail

echo "=== UNIT ==="
npm run test:unit 2>&1 | tee /tmp/bookmarknet-unit.log

echo ""
echo "=== INTEGRATION ==="
npm run test:integration 2>&1 | tee /tmp/bookmarknet-integration.log

echo ""
UNIT=$(sed -n 's/^# tests = \([0-9]*\)\/.*/\1/p' /tmp/bookmarknet-unit.log | tail -1 || true)
INTEG=$(sed -n 's/^# tests = \([0-9]*\)\/.*/\1/p' /tmp/bookmarknet-integration.log | tail -1 || true)

if [[ -z "$UNIT" || -z "$INTEG" ]]; then
  echo "Error: no se pudo extraer el total de tests de Brittle." >&2
  exit 1
fi

TOTAL=$((UNIT + INTEG))
echo "========================================="
echo "TOTAL: $UNIT unit + $INTEG integration = $TOTAL tests"
echo "========================================="
