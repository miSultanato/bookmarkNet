#!/bin/bash
set -euo pipefail

LOG_DIR="${TMPDIR:-/tmp}"
UNIT_LOG="$LOG_DIR/bookmarknet-unit.log"
INTEG_LOG="$LOG_DIR/bookmarknet-integration.log"

mkdir -p "$LOG_DIR"

echo "=== UNIT ==="
set +e
npm run test:unit 2>&1 | tee "$UNIT_LOG"
UNIT_STATUS=${PIPESTATUS[0]}
set -e

echo ""
echo "=== INTEGRATION ==="
set +e
npm run test:integration 2>&1 | tee "$INTEG_LOG"
INTEG_STATUS=${PIPESTATUS[0]}
set -e

show_failure() {
  local label="$1"
  local status="$2"
  local log_file="$3"

  if [[ "$status" -eq 0 ]]; then
    return
  fi

  echo ""
  echo "FALLARON LOS TESTS: $label (código de salida: $status)" >&2
  echo "Log: $log_file" >&2

  if grep -q "not ok" "$log_file"; then
    echo "--- Tests fallidos y contexto ---" >&2
    grep -n -E -B 2 -A 20 'not ok|Error:|TypeError:|RangeError:|AssertionError:|[[:space:]]at[[:space:]]' "$log_file" >&2 || true
  else
    echo "--- Últimas líneas del log ---" >&2
    tail -n 60 "$log_file" >&2
  fi
}

if [[ "$UNIT_STATUS" -ne 0 || "$INTEG_STATUS" -ne 0 ]]; then
  show_failure "unit" "$UNIT_STATUS" "$UNIT_LOG"
  show_failure "integration" "$INTEG_STATUS" "$INTEG_LOG"
  exit 1
fi

UNIT=$(sed -n 's/^# tests = \([0-9]*\)\/.*/\1/p' "$UNIT_LOG" | tail -1 || true)
INTEG=$(sed -n 's/^# tests = \([0-9]*\)\/.*/\1/p' "$INTEG_LOG" | tail -1 || true)

if [[ -z "$UNIT" || -z "$INTEG" ]]; then
  echo "Error: no se pudo extraer el total de tests de Brittle." >&2
  echo "Logs: $UNIT_LOG ; $INTEG_LOG" >&2
  exit 1
fi

TOTAL=$((UNIT + INTEG))
echo "========================================="
echo "TOTAL: $UNIT unit + $INTEG integration = $TOTAL tests"
echo "========================================="
