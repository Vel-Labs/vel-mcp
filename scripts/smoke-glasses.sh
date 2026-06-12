#!/usr/bin/env bash
set -euo pipefail
export VEL_GLASSES_PROVIDER=mock

echo "=== Smoke: @vel/glasses-mcp ==="

echo "[1/4] Building..."
pnpm --filter @vel/glasses-mcp build

echo "[2/4] Starting server..."
TMPDIR="${TMPDIR:-/tmp}"
OUT_FILE="$TMPDIR/vel-smoke-out-$$.txt"
IN_FIFO="$TMPDIR/vel-smoke-in-$$.fifo"
mkfifo "$IN_FIFO"

cleanup() {
  rm -f "$IN_FIFO" "$OUT_FILE" "$SMOKE_IMG" 2>/dev/null
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

node packages/glasses-mcp/dist/index.js < "$IN_FIFO" > "$OUT_FILE" 2>/dev/null &
SERVER_PID=$!
sleep 1

echo "[3/4] Running MCP handshake and tool call..."

# Step 1: initialize request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0.1.0"}}}' > "$IN_FIFO"
sleep 0.5
if ! grep -q '"serverInfo"' "$OUT_FILE" 2>/dev/null; then
  echo "FAIL: No initialize response"
  cat "$OUT_FILE"
  exit 1
fi
echo "    initialize: OK"

# Step 2: initialized notification (no id field)
echo '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' > "$IN_FIFO"
sleep 0.3

# Step 3: create a minimal valid PNG for the smoke test (in cwd, which is an allowed root)
SMOKE_IMG="smoke-test-$$.png"
# Minimal PNG: 16x16 black pixel (valid binary)
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x10\x00\x00\x00\x10\x08\x02\x00\x00\x00\x90\x77\x53\xde\x00\x00\x00\x12IDAT\x78\x9c\x62\xf8\xcf\xc0\x00\x00\x00\x00\xff\xff\x03\x00\x1e\x00\x01\x1b\xfc\xd6\x9f\x00\x00\x00\x00IEND\xae\x42\x60\x82' > "$SMOKE_IMG"

# Step 4: tools/call glasses.locate
echo "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"glasses.locate\",\"arguments\":{\"image\":{\"kind\":\"file_path\",\"value\":\"$SMOKE_IMG\"},\"query\":\"button\",\"outputType\":\"box\",\"maxResults\":1}}}" > "$IN_FIFO"
sleep 0.5

# Step 4: validate the tools/call response
CALL_RESPONSE=$(grep '"id":2' "$OUT_FILE" | tail -1 || echo "")
if [ -z "$CALL_RESPONSE" ]; then
  echo "FAIL: No tools/call response"
  cat "$OUT_FILE"
  exit 1
fi

echo "    glasses.locate: OK"

echo "[4/4] Validating response schema..."
echo "$CALL_RESPONSE" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const r = JSON.parse(d.result.content[0].text);
  if (!r.ok) { console.error('not ok'); process.exit(1); }
  if (r.result.matches.length !== 1) { console.error('wrong match count'); process.exit(1); }
  if (r.result.matches[0].label !== 'button') { console.error('wrong label'); process.exit(1); }
  if (!r.provider || r.provider.name !== 'mock') { console.error('wrong provider'); process.exit(1); }
  if (!Array.isArray(r.warnings)) { console.error('missing warnings'); process.exit(1); }
  console.log('OK');
" || {
  echo "FAIL: Schema validation failed"
  echo "$CALL_RESPONSE"
  exit 1
}
echo "    schema: OK"

echo "=== Smoke passed ==="
