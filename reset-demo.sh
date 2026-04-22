#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  PeerIslands · Spec-Driven Development · Demo Reset Script
#  Usage:
#    ./reset-demo.sh             — stop processes, wipe smartinvoice/, print next steps
#    ./reset-demo.sh --bootstrap — above + re-run specify init automatically
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEMO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ="$DEMO_DIR/smartinvoice"

# ── ANSI colours ──────────────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'
BLU='\033[0;34m'; CYN='\033[0;36m'; RST='\033[0m'

banner() { printf "\n${BLU}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}\n"; }
ok()     { printf "  ${GRN}✓${RST}  %s\n" "$*"; }
step()   { printf "\n${YLW}▸ %s${RST}\n" "$*"; }
info()   { printf "  ${CYN}→${RST}  %s\n" "$*"; }
err()    { printf "  ${RED}✗${RST}  %s\n" "$*" >&2; }

banner
printf "  ${BLU}PeerIslands · Spec-Driven Development · Demo Reset${RST}\n"
banner

# ── 1. Stop any running demo processes ────────────────────────────────────────
step "Stopping running demo processes"
pkill -f "react-scripts start" 2>/dev/null || true
pkill -f "node server.js"       2>/dev/null || true
pkill -f "nodemon"              2>/dev/null || true
sleep 1
pkill -9 -f "react-scripts start" 2>/dev/null || true
pkill -9 -f "node server.js"       2>/dev/null || true

for port in 3000 4000; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    ok "Port $port freed"
  else
    ok "Port $port already free"
  fi
done

# ── 2. Remove the project directory ───────────────────────────────────────────
step "Removing smartinvoice/ project directory"
if [ -d "$PROJ" ]; then
  rm -rf "$PROJ"
  ok "smartinvoice/ removed"
else
  ok "Nothing to remove (smartinvoice/ does not exist)"
fi

# ── 3. Bootstrap (optional) ───────────────────────────────────────────────────
if [[ "${1:-}" == "--bootstrap" ]]; then

  step "Checking prerequisites"

  if ! command -v node &>/dev/null; then
    err "Node.js not found. Install Node 20 LTS from https://nodejs.org"
    exit 1
  fi
  NODE_MAJOR=$(node -v | grep -oE '[0-9]+' | head -1)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    err "Node.js 20+ required. Found: $(node -v)"
    exit 1
  fi
  ok "Node.js $(node -v)"

  if ! command -v specify &>/dev/null; then
    err "specify CLI not found. Run:"
    info "uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v0.7.0"
    exit 1
  fi
  ok "specify CLI found: $(specify --version 2>/dev/null || echo '(version check unavailable)')"

  if ! command -v claude &>/dev/null; then
    err "claude CLI not found. Install Claude Code from https://claude.ai/code"
    exit 1
  fi
  ok "claude CLI found"

  step "Re-initialising spec-kit project"
  cd "$DEMO_DIR"
  specify init smartinvoice --ai claude
  ok "specify init complete"

  step "Verifying spec-kit setup"
  cd "$PROJ"
  specify check && ok "specify check passed"

  banner
  printf "  ${GRN}All set! Start the demo:${RST}\n\n"
  info "cd smartinvoice"
  info "claude"
  printf "\n  Then open ${CYN}peerislands-speckit-execution-guide.html${RST} in your browser.\n"
  banner

else

  # ── 4. Print next steps ───────────────────────────────────────────────────
  step "Reset complete — run these commands to start fresh"
  printf "\n"
  info "specify init smartinvoice --ai claude"
  info "cd smartinvoice"
  info "specify check"
  info "claude"
  printf "\n  ${YLW}TIP:${RST}  ./reset-demo.sh --bootstrap   runs all of the above automatically.\n"
  banner

fi
