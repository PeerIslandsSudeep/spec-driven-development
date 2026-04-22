#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  PeerIslands · Spec-Driven Development · Start Demo App
#  Run this AFTER /speckit.implement has generated the code inside Claude Code.
#  Usage: ./start-demo.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ="$DEMO_DIR/smartinvoice"
BACKEND="$PROJ/backend"
FRONTEND="$PROJ/frontend"
BACKEND_LOG="/tmp/smartinvoice-backend.log"
FRONTEND_LOG="/tmp/smartinvoice-frontend.log"

# ── ANSI colours ──────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; CYN='\033[0;36m'; RST='\033[0m'

banner() { printf "\n${BLU}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}\n"; }
ok()     { printf "  ${GRN}✓${RST}  %s\n" "$*"; }
step()   { printf "\n${YLW}▸ %s${RST}\n" "$*"; }
info()   { printf "  ${CYN}→${RST}  %s\n" "$*"; }
err()    { printf "  ${RED}✗${RST}  %s\n" "$*" >&2; }
warn()   { printf "  ${YLW}⚠${RST}  %s\n" "$*"; }

banner
printf "  ${BLU}PeerIslands · SmartInvoice · Start Demo App${RST}\n"
banner

# ── Validate generated project structure ──────────────────────────────────────
step "Validating generated project structure"
MISSING=0
for dir in "$BACKEND" "$FRONTEND"; do
  if [ -d "$dir" ]; then
    ok "$(basename "$dir")/ found"
  else
    err "$(basename "$dir")/ not found — run /speckit.implement in Claude Code first"
    MISSING=1
  fi
done
[ "$MISSING" -eq 1 ] && exit 1

# ── .env setup ────────────────────────────────────────────────────────────────
step "Checking backend environment configuration"
ENV_FILE="$BACKEND/.env"
ENV_EXAMPLE="$BACKEND/.env.example"

if [ -f "$ENV_FILE" ]; then
  # Validate MONGODB_URI is set and not a placeholder
  URI=$(grep -E '^MONGODB_URI=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')
  if [ -z "$URI" ] || [[ "$URI" == *"<"* ]] || [[ "$URI" == *"user:password"* ]]; then
    warn "MONGODB_URI in backend/.env looks like a placeholder."
    warn "Edit backend/.env and set a real MongoDB connection string before continuing."
    printf "\n  Press ENTER to continue anyway, or Ctrl+C to abort and fix .env first: "
    read -r _
  else
    ok ".env found with MONGODB_URI set"
  fi
elif [ -f "$ENV_EXAMPLE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  warn "Created backend/.env from .env.example"
  warn "MONGODB_URI is not set. Edit backend/.env now."
  printf "\n  Set MONGODB_URI in backend/.env, then press ENTER to continue: "
  read -r _
else
  err "No backend/.env or .env.example found. Create backend/.env with MONGODB_URI=<your-uri>"
  exit 1
fi

# ── Free ports ────────────────────────────────────────────────────────────────
step "Clearing ports 3000 and 4000"
for port in 3000 4000; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    ok "Port $port freed"
  else
    ok "Port $port already free"
  fi
done

# ── Install dependencies ───────────────────────────────────────────────────────
step "Installing backend dependencies"
cd "$BACKEND"
npm install --silent 2>/dev/null && ok "backend npm install done"

step "Installing frontend dependencies"
cd "$FRONTEND"
npm install --silent 2>/dev/null && ok "frontend npm install done"

# ── Start backend ─────────────────────────────────────────────────────────────
step "Starting backend server (port 4000)"
cd "$BACKEND"
> "$BACKEND_LOG"
node server.js >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# Wait up to 10 seconds for backend to be ready
READY=0
for i in $(seq 1 10); do
  sleep 1
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    err "Backend process exited. Check logs: tail -f $BACKEND_LOG"
    exit 1
  fi
  if curl -sf http://localhost:4000/api/dashboard >/dev/null 2>&1 || \
     curl -sf http://localhost:4000/api/invoices  >/dev/null 2>&1 || \
     curl -sf http://localhost:4000/health        >/dev/null 2>&1; then
    READY=1
    break
  fi
done

if [ "$READY" -eq 1 ]; then
  ok "Backend ready at http://localhost:4000 (PID $BACKEND_PID)"
else
  warn "Backend started (PID $BACKEND_PID) — health check inconclusive, continuing"
  info "Check: tail -f $BACKEND_LOG"
fi

# ── Start frontend ────────────────────────────────────────────────────────────
step "Starting frontend dev server (port 3000)"
cd "$FRONTEND"
> "$FRONTEND_LOG"
BROWSER=none npm start >> "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

# Wait up to 30 seconds for frontend to compile
READY=0
for i in $(seq 1 30); do
  sleep 1
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    err "Frontend process exited. Check logs: tail -f $FRONTEND_LOG"
    exit 1
  fi
  if grep -q "Compiled successfully" "$FRONTEND_LOG" 2>/dev/null; then
    READY=1
    break
  fi
done

if [ "$READY" -eq 1 ]; then
  ok "Frontend compiled and ready at http://localhost:3000 (PID $FRONTEND_PID)"
else
  warn "Frontend still compiling (PID $FRONTEND_PID) — opening browser in 3 s"
  info "Check: tail -f $FRONTEND_LOG"
fi

sleep 3

# ── Summary ───────────────────────────────────────────────────────────────────
banner
printf "  ${GRN}SmartInvoice is running!${RST}\n\n"
printf "  Backend  → ${CYN}http://localhost:4000${RST}  (PID $BACKEND_PID)\n"
printf "  Frontend → ${CYN}http://localhost:3000${RST}  (PID $FRONTEND_PID)\n"
printf "\n"
printf "  Logs:\n"
printf "    tail -f $BACKEND_LOG\n"
printf "    tail -f $FRONTEND_LOG\n"
printf "\n"
printf "  To reset everything:  ${YLW}./reset-demo.sh${RST}\n"
banner

# Open browser
open "http://localhost:3000" 2>/dev/null || \
  xdg-open "http://localhost:3000" 2>/dev/null || \
  printf "\n  Open ${CYN}http://localhost:3000${RST} in your browser.\n"
