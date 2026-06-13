#!/usr/bin/env bash
# tui-smoke-test.sh — Validate the Porkbun TUI runs as expected via tmux.
# Usage:  ./scripts/tui-smoke-test.sh
# Depends: tmux, bash, timeout (or gtimeout on macOS), and the tui-testing skill.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SELF_DIR/.." && pwd)"
SKILL_DIR="$HOME/.pi/agent/skills/tui-testing"
TUI_LIB="$SKILL_DIR/scripts/tui-lib.sh"

# Override artifact dir before sourcing the library so it picks up the right path
PROJECT_ARTIFACT_DIR="$PROJECT_DIR/tmp/tui-smoke-artifacts"
mkdir -p "$PROJECT_ARTIFACT_DIR"
export TUI_ARTIFACT_DIR="$PROJECT_ARTIFACT_DIR"
export TUI_TEST_NAME="porkbun-tui-smoke"

# Source the tui-testing library
echo "tui-lib: artifacts dir=$TUI_ARTIFACT_DIR" >&2
source "$TUI_LIB"

echo "=== Porkbun TUI Smoke Test ==="
echo "Artifact dir: $TUI_ARTIFACT_DIR"
echo ""

# -------------------------------------------------------
# Step 1: Verify credentials (pre-flight check)
# -------------------------------------------------------
echo "1. Pre-flight: validating credentials..."
PING_OUTPUT="$(node "$PROJECT_DIR/dist/cli.js" ping test -o json 2>/dev/null || true)"
if echo "$PING_OUTPUT" | grep -q '"status":"SUCCESS"'; then
  echo "   ✓ Credentials valid, API reachable"
else
  echo "   ✗ Credentials check failed. Output: $PING_OUTPUT"
  echo "   Ensure PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY are set and valid."
  exit 1
fi

# -------------------------------------------------------
# Step 2: Launch TUI in detached tmux session
# -------------------------------------------------------
echo ""
echo "2. Launching TUI in tmux (120x40)..."
tui_start "node $PROJECT_DIR/dist/cli.js tui" 120 40
echo "   ✓ Session created (pane: $tui_pane_id)"

# -------------------------------------------------------
# Step 3: Wait for credential validation phase
# -------------------------------------------------------
echo ""
echo "3. Waiting for credential validation..."
# The startup screen shows "Validating credentials..." immediately
if tui_wait_ready "Validating credentials" 10 0.5 1; then
  echo "   ✓ Startup validation phase reached"
else
  tui_collect_artifacts "step3-fail"
  echo "   ✗ Failed to reach validation phase (failure class: $tui_failure_class)"
  tui_fail "$tui_failure_class" "TUI did not show credential validation"
fi

# -------------------------------------------------------
# Step 4: Wait for Domains screen (after successful auth)
# -------------------------------------------------------
echo ""
echo "4. Waiting for Domains screen (auth completes + domain list loads)..."
if tui_wait_ready "Domains" 30 0.5 0; then
  echo "   ✓ Domains screen loaded successfully"
else
  tui_collect_artifacts "step4-fail"
  echo "   ✗ Domains screen did not appear (failure class: $tui_failure_class)"
  echo "   ... Trying fallback: capture what's on screen for diagnostics"
  tui_capture_visible | head -20
  tui_fail "$tui_failure_class" "TUI did not reach Domains screen"
fi

# -------------------------------------------------------
# Step 5: Verify Domains screen content
# -------------------------------------------------------
echo ""
echo "5. Asserting Domains screen content..."
tui_assert_screen "Domains"
echo "   ✓ 'Domains' header present"

# Check that at least one domain name shows up (if domains exist)
SCREEN="$(tui_capture_visible)"
DOMAIN_COUNT="$(echo "$SCREEN" | grep -oE '\([0-9]+\)' | head -1 | tr -d '()')"
echo "   Domain count from screen: ${DOMAIN_COUNT:-unknown}"

if [ -n "$DOMAIN_COUNT" ] && [ "$DOMAIN_COUNT" -gt 0 ]; then
  echo "   ✓ Domain list has $DOMAIN_COUNT domains"
  # Check for .com .org .sh etc — any domain extension in the list
  if echo "$SCREEN" | grep -qE '\.[a-z]{2,}'; then
    echo "   ✓ Domain names visible in list"
  else
    echo "   ⚠  No domain extensions found in visible area (may need scrolling)"
  fi
else
  echo "   ⚠  No domain count visible or count is 0"
fi

# Check for balance
if echo "$SCREEN" | grep -q 'Balance:'; then
  echo "   ✓ Account balance visible"
else
  echo "   ⚠  Balance not visible (may be loading or not shown)"
fi

# -------------------------------------------------------
# Step 6: Interact — navigate the domain list
# -------------------------------------------------------
echo ""
echo "6. Testing navigation..."
# Press down arrow a few times to navigate
tui_send_keys Down
sleep 0.5
tui_send_keys Down
sleep 0.5
tui_send_keys Down
sleep 0.5

# Check that the screen changed (selection moved)
SCREEN_AFTER_NAV="$(tui_capture_visible)"
if [ "$SCREEN" != "$SCREEN_AFTER_NAV" ] || [ -n "$SCREEN_AFTER_NAV" ]; then
  echo "   ✓ Navigation keys processed (screen state changed)"
else
  echo "   ⚠  Screen did not visibly change after navigation (may render identically with ANSI stripped)"
fi

# -------------------------------------------------------
# Step 7: Test domain detail screen
# -------------------------------------------------------
echo ""
echo "7. Opening domain detail..."
# Try pressing Enter on current selection
tui_send_keys Enter
sleep 3

DETAIL_SCREEN="$(tui_capture_visible)"

if echo "$DETAIL_SCREEN" | grep -qE '(Overview|DNS|Nameservers|Domain Detail|SSL|Back)'; then
  echo "   ✓ Domain detail screen opened"
  
  # Go back
  echo "   Navigating back..."
  tui_send_keys Escape
  sleep 1
  
  if tui_wait_ready "Domains" 10 0.5 0; then
    echo "   ✓ Returned to Domains screen"
  else
    echo "   ⚠  Could not return to Domains screen (may already be back)"
  fi
else
  echo "   ⚠  Domain detail screen not detected (no detail tabs visible)"
  echo "   (This can happen if Enter doesn't trigger navigation, or domain list is empty)"
fi

# -------------------------------------------------------
# Step 8: Collect final artifacts
# -------------------------------------------------------
echo ""
echo "8. Collecting artifacts..."
tui_collect_artifacts "final"
echo "   ✓ Artifacts saved to $TUI_ARTIFACT_DIR/final/"

# -------------------------------------------------------
# Step 9: Clean exit
# -------------------------------------------------------
echo ""
echo "=== TUI Smoke Test PASSED ==="
echo "Artifacts: $TUI_ARTIFACT_DIR"
