#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${DEPLOY_APP_DIR:-/home/bilal/sleeper-agent}"
BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"
SERVICE="${DEPLOY_SERVICE:-sleeper-agent-web.service}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-http://192.168.1.114:5181/api/health}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/sleeper-agent-web-deploy.lock}"
FORCE_RESET="${DEPLOY_FORCE_RESET:-false}"
SYSTEMCTL_BIN="${DEPLOY_SYSTEMCTL_BIN:-$(command -v systemctl)}"

log() {
  printf '[deploy] %s\n' "$*"
}

run_systemctl() {
  if [[ "${EUID}" -eq 0 ]]; then
    "${SYSTEMCTL_BIN}" "$@"
  else
    sudo -n "${SYSTEMCTL_BIN}" "$@"
  fi
}

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  log "another deployment is already running"
  exit 1
fi

cd "${APP_DIR}"

log "fetching ${REMOTE}/${BRANCH}"
git fetch --prune "${REMOTE}" "${BRANCH}"

current_branch="$(git branch --show-current)"
if [[ "${current_branch}" != "${BRANCH}" ]]; then
  log "expected ${APP_DIR} to be on ${BRANCH}, found ${current_branch:-detached}"
  exit 1
fi

if [[ "${FORCE_RESET}" == "true" ]]; then
  log "resetting checkout to ${REMOTE}/${BRANCH}"
  git reset --hard "${REMOTE}/${BRANCH}"
else
  log "fast-forwarding checkout"
  git pull --ff-only "${REMOTE}" "${BRANCH}"
fi

log "installing dependencies"
npm ci

log "generating Prisma client"
npx prisma generate

log "applying database migrations"
npx prisma migrate deploy

log "building app"
npm run build

log "restarting ${SERVICE}"
run_systemctl restart "${SERVICE}"

log "waiting for health check: ${HEALTH_URL}"
for attempt in {1..30}; do
  if curl -fsS "${HEALTH_URL}" >/dev/null; then
    log "deployment complete"
    exit 0
  fi
  sleep 1
done

log "health check failed after restart"
run_systemctl status --no-pager "${SERVICE}" || true
exit 1
