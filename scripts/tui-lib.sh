#!/usr/bin/env bash
# Minimal local TUI smoke-test helpers.
# Usage: source ./scripts/tui-lib.sh

set -euo pipefail

: "${TUI_ARTIFACT_DIR:?TUI_ARTIFACT_DIR must be set before sourcing tui-lib.sh}"
: "${TUI_TEST_NAME:?TUI_TEST_NAME must be set before sourcing tui-lib.sh}"

: "${tui_failure_class:=}"
: "${tui_pane_id:=}"

_tui_session_name="${TUI_TEST_NAME}-$$"

_tui_capture() {
  tmux capture-pane -pt "$tui_pane_id" -p
}

_tui_wait_for_needle() {
  local needle="$1"
  local timeout="$2"
  local interval="$3"
  local now
  local deadline
  now="$(date +%s)"
  deadline="$((now + timeout))"

  while [ "$(date +%s)" -lt "$deadline" ]; do
    if _tui_capture | grep -qF -- "$needle"; then
      return 0
    fi
    sleep "$interval"
  done

  return 1
}

tui_start() {
  local cmd="$1"
  local cols="$2"
  local rows="$3"

  tmux new-session -d -x "$cols" -y "$rows" -s "$_tui_session_name" bash -lc "$cmd"
  tui_pane_id="$_tui_session_name:0.0"
}

tui_wait_ready() {
  local needle="$1"
  local timeout="$2"
  local interval="$3"

  if _tui_wait_for_needle "$needle" "$timeout" "$interval"; then
    return 0
  fi

  tui_failure_class="timeout"
  return 1
}

tui_capture_visible() {
  _tui_capture
}

tui_send_keys() {
  tmux send-keys -t "$tui_pane_id" "$@"
}

tui_assert_screen() {
  local needle="$1"
  if ! _tui_capture | grep -qF -- "$needle"; then
    tui_fail "assertion" "Expected screen to contain '$needle'"
  fi
}

tui_collect_artifacts() {
  local label="$1"
  local dir="$TUI_ARTIFACT_DIR/$label"
  mkdir -p "$dir"
  _tui_capture >"$dir/screen.txt"
  tmux capture-pane -pt "$tui_pane_id" -S -1000 >"$dir/history.txt" || true
}

tui_fail() {
  local class="$1"
  local message="$2"
  tui_failure_class="$class"
  echo "[$class] $message" >&2
  exit 1
}
