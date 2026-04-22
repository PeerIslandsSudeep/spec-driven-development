#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  PeerIslands · Spec-Driven Development · Pre-Flight Check
#  Run this before the live demo to validate the environment.
#  Usage: ./preflight.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

# ── ANSI colours ──────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; CYN='\033[0;36m'; RST='\033[0m'

banner() { printf "\n${BLU}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}\n"; }
ok()     { printf "  ${GRN}✓${RST}  %s\n" "$*"; }
fail()   { printf "  ${RED}✗${RST}  %s\n" "$*"; FAILED=$((FAILED+1)); }
warn()   { printf "  ${YLW}⚠${RST}  %s\n" "$*"; }
info()   { printf "  ${CYN}→${RST}  %s\n" "$*"; }
FAILED=0

banner
printf "  ${BLU}PeerIslands · SmartInvoice SDD · Pre-Flight Check${RST}\n"
banner

# ── Node.js ───────────────────────────────────────────────────────────────────
printf "\n  Checking runtime & CLI tools\n"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  NODE_MAJOR=$(echo "$NODE_VER" | grep -oE '[0-9]+' | head -1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    ok "Node.js $NODE_VER"
  else
    fail "Node.js 20+ required — found $NODE_VER"
    info "Install from https://nodejs.org"
  fi
else
  fail "Node.js not found"
  info "Install from https://nodejs.org"
fi

# ── npm ───────────────────────────────────────────────────────────────────────
if command -v npm &>/dev/null; then
  ok "npm $(npm -v)"
else
  fail "npm not found (should ship with Node.js)"
fi

# ── specify CLI ───────────────────────────────────────────────────────────────
if command -v specify &>/dev/null; then
  VER=$(specify --version 2>/dev/null || echo "installed")
  ok "specify CLI ($VER)"
else
  fail "specify CLI not found"
  info "Run: uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v0.7.0"
fi

# ── uv ────────────────────────────────────────────────────────────────────────
if command -v uv &>/dev/null; then
  ok "uv $(uv --version 2>/dev/null | head -1 || echo 'installed')"
else
  warn "uv not found — needed to install/update specify CLI"
  info "Run: curl -LsSf https://astral.sh/uv/install.sh | sh"
fi

# ── Claude Code ───────────────────────────────────────────────────────────────
if command -v claude &>/dev/null; then
  ok "claude CLI found"
else
  fail "claude CLI not found"
  info "Install Claude Code from https://claude.ai/code"
fi

# ── Git ───────────────────────────────────────────────────────────────────────
if command -v git &>/dev/null; then
  ok "git $(git --version | awk '{print $3}')"
else
  fail "git not found"
fi

# ── Ports ─────────────────────────────────────────────────────────────────────
printf "\n  Checking ports\n"
for port in 3000 4000; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    warn "Port $port is in use (PIDs: $pids)"
    info "Run ./reset-demo.sh to free it before the demo"
  else
    ok "Port $port is free"
  fi
done

# ── smartinvoice directory ────────────────────────────────────────────────────
printf "\n  Checking project state\n"
DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ="$DEMO_DIR/smartinvoice"

if [ -d "$PROJ" ]; then
  warn "smartinvoice/ already exists"
  info "Run ./reset-demo.sh to wipe it and start fresh, OR continue from where you left off"
else
  ok "smartinvoice/ not present — ready for a clean run"
fi

# ── MongoDB connectivity (optional) ───────────────────────────────────────────
printf "\n  Checking MongoDB connectivity\n"
if command -v mongosh &>/dev/null; then
  if mongosh --eval "db.runCommand({ping:1})" --quiet mongodb://localhost:27017 &>/dev/null; then
    ok "Local MongoDB reachable at mongodb://localhost:27017"
  else
    warn "Local MongoDB not reachable — use a MongoDB Atlas URI in backend/.env"
  fi
else
  warn "mongosh not installed — skipping local MongoDB check"
  info "If using MongoDB Atlas, ensure your Atlas URI is ready for backend/.env"
fi

# ── Internet (for Google Fonts in guide HTML) ─────────────────────────────────
printf "\n  Checking internet access\n"
if curl -sf --max-time 3 https://fonts.googleapis.com >/dev/null 2>&1; then
  ok "Internet reachable (Google Fonts will load in guide)"
else
  warn "Internet not reachable — guide HTML will still work with fallback fonts"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
banner
if [ "$FAILED" -eq 0 ]; then
  printf "  ${GRN}All critical checks passed — you are ready to demo!${RST}\n"
  printf "\n  Next: ${CYN}./reset-demo.sh --bootstrap${RST}  or  ${CYN}specify init smartinvoice --ai claude${RST}\n"
else
  printf "  ${RED}$FAILED critical check(s) failed — fix the above before going live.${RST}\n"
fi
banner
