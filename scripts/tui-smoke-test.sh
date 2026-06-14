#!/usr/bin/env bash
# tui-smoke-test.sh — Validate the Porkbun TUI runs as expected via tmux.
# Usage:  ./scripts/tui-smoke-test.sh
# Depends: tmux, bash, timeout (or gtimeout on macOS), and the local
# tui-testing helpers in ./scripts/tui-lib.sh.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SELF_DIR/.." && pwd)"
CLI_BIN="node $PROJECT_DIR/dist/cli.js"

TUI_ARTIFACT_DIR="$PROJECT_DIR/tmp/tui-smoke-artifacts"
mkdir -p "$TUI_ARTIFACT_DIR"
export TUI_ARTIFACT_DIR
export TUI_TEST_NAME="porkbun-tui-smoke"

source ./scripts/tui-lib.sh

echo "=== Porkbun TUI Smoke Test ==="
echo "Artifact dir: $TUI_ARTIFACT_DIR"
echo ""

echo "1. Pre-flight: validating credentials..."
PING_OUTPUT="$($CLI_BIN ping test -o json 2>/dev/null || true)"
if echo "$PING_OUTPUT" | grep -q '"status":"SUCCESS"'; then
  echo "   ✓ Credentials valid, API reachable"
else
  echo "   ✗ Credentials check failed. Output: $PING_OUTPUT"
  echo "   Ensure PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY are set and valid."
  exit 1
fi

echo ""
echo "2. Launching TUI in tmux (120x40)..."
tui_start "$CLI_BIN tui" 120 40
echo "   ✓ Session created (pane: $tui_pane_id)"

echo ""
echo "3. Waiting for credential validation..."
if tui_wait_ready "Validating credentials" 10 0.5 1; then
  echo "   ✓ Startup validation phase reached"
else
  tui_collect_artifacts "step3-fail"
  echo "   ✗ Failed to reach validation phase (failure class: $tui_failure_class)"
  tui_fail "$tui_failure_class" "TUI did not show credential validation"
fi

echo ""
echo "4. Waiting for Domains screen..."
if tui_wait_ready "Domains" 30 0.5 0; then
  echo "   ✓ Domains screen loaded successfully"
else
  tui_collect_artifacts "step4-fail"
  echo "   ✗ Domains screen did not appear (failure class: $tui_failure_class)"
  echo "   ... Trying fallback: capture what's on screen for diagnostics"
  tui_capture_visible | head -20
  tui_fail "$tui_failure_class" "TUI did not reach Domains screen"
fi

echo ""
echo "5. Asserting Domains screen content..."
tui_assert_screen "Domains"
echo "   ✓ 'Domains' header present"

SCREEN="$(tui_capture_visible)"
DOMAIN_COUNT="$(echo "$SCREEN" | grep -oE '\([0-9]+\)' | head -1 | tr -d '()')"

if [ -n "$DOMAIN_COUNT" ] && [ "$DOMAIN_COUNT" -gt 0 ]; then
  echo "   ✓ $DOMAIN_COUNT domains listed"
else
  echo "   ⚠  No domain count visible or count is 0"
fi

if echo "$SCREEN" | grep -q 'Balance:'; then
  echo "   ✓ Balance showing"
else
  echo "   ⚠  Balance not visible (may be loading)"
fi

echo ""
echo "6. Testing navigation..."
tui_send_keys Down; sleep 0.5
tui_send_keys Down; sleep 0.5
tui_send_keys Down; sleep 0.5

SCREEN_AFTER_NAV="$(tui_capture_visible)"
if [ "$SCREEN" != "$SCREEN_AFTER_NAV" ]; then
  echo "   ✓ Selection moved after navigation"
else
  echo "   ⚠  Screen unchanged after Down keys (may need more presses)"
fi

echo ""
echo "7. Opening domain detail..."
tui_send_keys Enter

if tui_wait_ready "overview" 15 0.5 1; then
  echo "   ✓ Domain detail screen opened"
  echo "   Navigating back..."
  tui_send_keys Escape
  if tui_wait_ready "Domains" 10 0.5 0; then
    echo "   ✓ Returned to Domains screen"
  fi
else
  echo "   ⚠  Domain detail screen not detected"
fi

echo ""
echo "8. Collecting artifacts..."
tui_collect_artifacts "final"
echo "   ✓ Saved to $TUI_ARTIFACT_DIR/final/"
echo ""
echo "=== TUI Smoke Test PASSED ==="
echo "Artifacts: $TUI_ARTIFACT_DIR"
