#!/usr/bin/env bash
#
# bip39-explorer — Linux quick-start installer (Ubuntu / Debian / Raspberry Pi OS).
#
# One command, run as root, installs the explorer as a hardened systemd service:
#
#   curl -fsSL https://raw.githubusercontent.com/chinmay28/bip39-explorer/main/scripts/quickstart.sh | sudo bash
#
# It clones the repository and builds it here. Node and Go are needed at BUILD
# time only (both installed automatically if missing); the running service has
# no Node, npm, or JS runtime dependency — the deployed artifact is a single
# static Go binary with the PWA embedded.
#
# It is deliberately *non-disruptive* — re-run it any time to upgrade in place:
#
#   * Idempotent. Re-running only swaps in newer code.
#   * The new binary is built while the old one keeps serving. If the build
#     fails, the running service is left untouched.
#   * After restart we poll /healthz; if the new version is unhealthy we ROLL
#     BACK to the previous binary and restart it — so a bad upgrade self-heals
#     to the last good state.
#
# Simpler than its sibling project CountRoster in one important way: this app
# has NO DATABASE. The wordlist and the semantic index are compiled into the
# client, and the server holds no state at all. There is nothing to snapshot,
# nothing to migrate and nothing an upgrade can lose — so the whole
# backup/restore half of that script is absent by design, not by omission.
#
# Configure via environment variables (all optional):
#
#   BIP39_REPO       git URL to clone       (default: https://github.com/chinmay28/bip39-explorer.git)
#   BIP39_REF        branch/tag/commit      (default: main)
#   BIP39_USER       service system user    (default: bip39)
#   BIP39_PREFIX     install prefix         (default: /opt/bip39-explorer; source → $PREFIX/src)
#   PORT             port to listen on      (default: 8788)
#   HOST             bind address           (default: 0.0.0.0)
#   INSTALL_NODE     auto | never           install Node 22 if missing/old (default: auto)
#   INSTALL_GO       auto | never           install Go if missing/old (default: auto)
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'
  C_RED=$'\033[1;31m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
  C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_DIM=''; C_OFF=''
fi
log()  { printf '%s==>%s %s\n' "$C_BLUE" "$C_OFF" "$*"; }
ok()   { printf '%s ok %s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%swarn%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }
die()  { printf '%serr %s %s\n' "$C_RED" "$C_OFF" "$*" >&2; exit 1; }
step() { printf '\n%s%s%s\n' "$C_DIM" "$*" "$C_OFF"; }

# ---------------------------------------------------------------------------
# Must be root (system-wide service + dedicated user)
# ---------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  die "Run as root: curl -fsSL .../quickstart.sh | sudo bash   (or: sudo ./scripts/quickstart.sh)"
fi
command -v systemctl >/dev/null 2>&1 || die "systemd is required (no systemctl found)."

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BIP39_REPO="${BIP39_REPO:-https://github.com/chinmay28/bip39-explorer.git}"
BIP39_REF="${BIP39_REF:-main}"
SVC_USER="${BIP39_USER:-bip39}"
PREFIX="${BIP39_PREFIX:-/opt/bip39-explorer}"
PORT="${PORT:-8788}"
HOST="${HOST:-0.0.0.0}"
INSTALL_NODE="${INSTALL_NODE:-auto}"
INSTALL_GO="${INSTALL_GO:-auto}"

SRC_DIR="$PREFIX/src"
BIN_DIR="$PREFIX/bin"
BIN_PATH="$BIN_DIR/bip39-explorer"
SERVICE_NAME="bip39-explorer"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
NODE_MIN_MAJOR=20
GO_MIN_MINOR=22
GO_INSTALL_VERSION="1.24.7"

# If this script is being run from inside an existing checkout rather than
# piped from curl, build that checkout in place.
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" >/dev/null 2>&1 && pwd)"
if [ -f "$SELF_DIR/../package.json" ] && [ -d "$SELF_DIR/../server" ]; then
  SRC_DIR="$(cd "$SELF_DIR/.." && pwd)"
  IN_PLACE=1
else
  IN_PLACE=0
fi

# ---------------------------------------------------------------------------
# Build-time toolchains
# ---------------------------------------------------------------------------
install_packages() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends "$@"
}

ensure_base() {
  local missing=()
  for tool in git curl ca-certificates; do
    command -v "${tool%% *}" >/dev/null 2>&1 || missing+=("$tool")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    log "Installing ${missing[*]}"
    install_packages "${missing[@]}"
  fi
}

node_major() { node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/'; }

ensure_node() {
  local major
  major="$(node_major || true)"
  if [ -n "$major" ] && [ "$major" -ge "$NODE_MIN_MAJOR" ]; then
    ok "Node $(node -v) (build-time only)"
    return
  fi
  [ "$INSTALL_NODE" = "auto" ] || die "Node >= $NODE_MIN_MAJOR is required to build the client."
  log "Installing Node 22 (build-time only)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  install_packages nodejs
  ok "Node $(node -v)"
}

go_minor() { go version 2>/dev/null | sed -n 's/.*go1\.\([0-9]*\).*/\1/p'; }

ensure_go() {
  local minor
  minor="$(go_minor || true)"
  if [ -n "$minor" ] && [ "$minor" -ge "$GO_MIN_MINOR" ]; then
    ok "$(go version) (build-time only)"
    return
  fi
  [ "$INSTALL_GO" = "auto" ] || die "Go >= 1.$GO_MIN_MINOR is required to build the server."
  local arch
  case "$(uname -m)" in
    x86_64)  arch=amd64 ;;
    aarch64) arch=arm64 ;;
    armv7l)  arch=armv6l ;;
    *) die "unsupported architecture $(uname -m) — install Go manually and re-run" ;;
  esac
  log "Installing Go ${GO_INSTALL_VERSION} for ${arch} (build-time only)"
  curl -fsSL "https://go.dev/dl/go${GO_INSTALL_VERSION}.linux-${arch}.tar.gz" -o /tmp/go.tgz
  rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tgz && rm -f /tmp/go.tgz
  export PATH="/usr/local/go/bin:$PATH"
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
  ok "$(go version)"
}

# ---------------------------------------------------------------------------
# Service account and layout
# ---------------------------------------------------------------------------
ensure_user() {
  if id -u "$SVC_USER" >/dev/null 2>&1; then
    ok "Service user $SVC_USER exists"
  else
    log "Creating system user $SVC_USER"
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SVC_USER"
  fi
  mkdir -p "$BIN_DIR"
}

# ---------------------------------------------------------------------------
# Source
# ---------------------------------------------------------------------------
fetch_source() {
  if [ "$IN_PLACE" = "1" ]; then
    ok "Building the checkout at $SRC_DIR"
    return
  fi
  if [ -d "$SRC_DIR/.git" ]; then
    log "Updating $SRC_DIR"
    git -C "$SRC_DIR" fetch --quiet --tags origin
    git -C "$SRC_DIR" checkout --quiet "$BIP39_REF"
    git -C "$SRC_DIR" pull --quiet --ff-only origin "$BIP39_REF" 2>/dev/null || true
  else
    log "Cloning $BIP39_REPO into $SRC_DIR"
    mkdir -p "$(dirname "$SRC_DIR")"
    # Not --depth 1: the version number is the commit count, and a shallow
    # clone would report patch 0. --filter=blob:none is nearly as cheap and
    # keeps the whole commit graph.
    git clone --quiet --filter=blob:none --branch "$BIP39_REF" "$BIP39_REPO" "$SRC_DIR"
  fi
}

# ---------------------------------------------------------------------------
# Build. The new binary is staged beside the live one; nothing is swapped in
# until it has been built successfully.
# ---------------------------------------------------------------------------
STAGED="$BIN_PATH.new"

build() {
  step "Building (this takes a few minutes on a Raspberry Pi)"
  cd "$SRC_DIR"
  npm ci --silent 2>/dev/null || npm install --silent
  npm run build --workspace @bip39-explorer/web

  # Embed the built client in the binary — a truly single-file deploy.
  rm -rf server/cmd/bip39-explorer/webdist
  mkdir -p server/cmd/bip39-explorer/webdist
  cp -r apps/web/dist/. server/cmd/bip39-explorer/webdist/

  local patch
  patch="$(node scripts/version.mjs --patch)"
  ( cd server && CGO_ENABLED=0 go build -trimpath \
      -ldflags "-s -w -X github.com/chinmay28/bip39-explorer/server/internal/version.Patch=${patch}" \
      -o "$STAGED" ./cmd/bip39-explorer )
  chmod 0755 "$STAGED"
  ok "Built $("$STAGED" version)"
}

# ---------------------------------------------------------------------------
# systemd unit. No state directory: the service reads nothing and writes
# nothing, so it can be locked down hard.
# ---------------------------------------------------------------------------
write_unit() {
  log "Writing $UNIT_PATH"
  cat > "$UNIT_PATH" <<UNIT
[Unit]
Description=BIP-39 Explorer
Documentation=https://github.com/chinmay28/bip39-explorer
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SVC_USER}
Group=${SVC_USER}
ExecStart=${BIN_PATH} serve --host ${HOST} --port ${PORT}
Restart=on-failure
RestartSec=2

# The process serves read-only bytes it already carries. It needs no
# filesystem, no state, no privileges and — notably — no network beyond its
# own listening socket.
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
ProtectProc=invisible
RestrictAddressFamilies=AF_INET AF_INET6
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
MemoryDenyWriteExecute=yes
SystemCallArchitectures=native
SystemCallFilter=@system-service
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
}

# ---------------------------------------------------------------------------
# Swap in, verify, and roll back if the new version is unhealthy
# ---------------------------------------------------------------------------
PREVIOUS="$BIN_PATH.previous"

healthy() {
  local i
  for i in $(seq 1 30); do
    if curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

activate() {
  step "Activating"
  if [ -f "$BIN_PATH" ]; then
    cp -f "$BIN_PATH" "$PREVIOUS"
  fi
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  mv -f "$STAGED" "$BIN_PATH"
  chown root:root "$BIN_PATH"
  systemctl enable --quiet "$SERVICE_NAME"
  systemctl start "$SERVICE_NAME"

  if healthy; then
    ok "Healthy: $(curl -fsS "http://127.0.0.1:${PORT}/healthz")"
    return
  fi

  warn "The new version did not come up healthy."
  if [ -f "$PREVIOUS" ]; then
    warn "Rolling back to the previous binary."
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    mv -f "$PREVIOUS" "$BIN_PATH"
    systemctl start "$SERVICE_NAME"
    if healthy; then
      die "Rolled back. The previous version is serving again; the new build is not installed."
    fi
  fi
  journalctl -u "$SERVICE_NAME" -n 30 --no-pager >&2 || true
  die "Service is unhealthy and there is nothing to roll back to."
}

# ---------------------------------------------------------------------------
main() {
  step "bip39-explorer quick-start"
  ensure_base
  ensure_node
  ensure_go
  ensure_user
  fetch_source
  build
  write_unit
  activate

  local address="$HOST"
  [ "$address" = "0.0.0.0" ] && address="$(hostname -I 2>/dev/null | awk '{print $1}')"
  step "Done"
  ok "Serving on http://${address:-localhost}:${PORT}"
  printf '  %sstatus:%s systemctl status %s\n' "$C_DIM" "$C_OFF" "$SERVICE_NAME"
  printf '  %slogs:  %s journalctl -u %s -f\n' "$C_DIM" "$C_OFF" "$SERVICE_NAME"
  printf '  %supgrade:%s re-run this script\n' "$C_DIM" "$C_OFF"
}

main "$@"
