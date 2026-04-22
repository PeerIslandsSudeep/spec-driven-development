#!/usr/bin/env bash
# Stop the SmartInvoice backend (port 4000) and frontend (port 3000).
# Safe to re-run; reports what was actually stopped.

set -u

BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PID_FILE="/tmp/smartinvoice-backend.pid"
FRONTEND_PID_FILE="/tmp/smartinvoice-frontend.pid"

stop_by_port() {
  local name="$1" port="$2"
  local pids
  pids=$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -z "$pids" ]]; then
    echo "  [$name] nothing listening on :$port"
    return 0
  fi
  echo "  [$name] stopping PIDs on :$port: $(echo $pids | tr '\n' ' ')"
  kill $pids 2>/dev/null || true
  sleep 1
  # Re-check; force-kill anything still alive
  local still
  still=$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "$still" ]]; then
    echo "  [$name] force-killing: $still"
    kill -9 $still 2>/dev/null || true
  fi
}

stop_by_pidfile() {
  local name="$1" file="$2"
  [[ -f "$file" ]] || return 0
  local pid
  pid=$(cat "$file" 2>/dev/null || true)
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "  [$name] stopping PID $pid from $file"
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$file"
}

echo "Stopping SmartInvoice…"

echo "- Backend"
stop_by_pidfile "backend" "$BACKEND_PID_FILE"
stop_by_port    "backend" "$BACKEND_PORT"

echo "- Frontend"
stop_by_pidfile "frontend" "$FRONTEND_PID_FILE"
stop_by_port    "frontend" "$FRONTEND_PORT"

echo "Done."
