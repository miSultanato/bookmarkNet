#!/bin/bash
set -euo pipefail

echo "=== UNIT ==="
npm run test:unit 2>&1 | tee /tmp/bookmarknet-unit.log

echo ""
echo "=== INTEGRATION ==="
npm run test:integration 2>&1 | tee /tmp/bookmarknet-integration.log

echo ""
UNIT=$(grep -oP '# tests = \K[0-9]+' /tmp/bookmarknet-unit.log | tail -1 || true)
INTEG=$(grep -oP '# tests = \K[0-9]+' /tmp/bookmarknet-integration.log | tail -1 || true)

if [[ -z "$UNIT" || -z "$INTEG" ]]; then
  echo "Error: no se pudo extraer el total de tests de Brittle." >&2
  exit 1
fi

TOTAL=$((UNIT + INTEG))
echo "========================================="
echo "TOTAL: $UNIT unit + $INTEG integration = $TOTAL tests"
echo "========================================="
