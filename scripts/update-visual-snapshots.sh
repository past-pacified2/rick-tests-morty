#!/usr/bin/env bash
#
# Regenerates the Playwright screenshot baselines inside the official container.
#
# The container is not a convenience. `snapshotPathTemplate` keys on {platform}, WSL
# reports linux the same way CI's runner does, and a baseline written by the host's
# fonts and GPU differs from the container's by enough pixels to fail. Anything written
# outside this image is a baseline CI cannot match.
#
# Usage:
#   npm run test:visual:update                    # every visual spec, all projects
#   npm run test:visual:update -- --project=chromium
#   npm run test:visual:update -- -g "name filter"
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

SPEC_PATH="tests/e2e/visual.spec.ts"
SNAPSHOT_DIR="tests/__screenshots__"

# Pinned to the installed Playwright: a container newer or older than the library
# renders differently, and the mismatch surfaces as a diff nobody can explain.
PLAYWRIGHT_VERSION="$(node -p "require('./package.json').devDependencies['@playwright/test'].replace(/^[^0-9]*/, '')")"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"

fail() {
  echo "" >&2
  echo "update-visual-snapshots: $1" >&2
  shift
  for line in "$@"; do
    echo "  $line" >&2
  done
  echo "" >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  fail "docker is not on PATH." \
    "On WSL this usually means Docker Desktop's integration for this distro is off." \
    "Docker Desktop → Settings → Resources → WSL Integration → enable this distro, then Apply & Restart."
fi

if ! docker info >/dev/null 2>&1; then
  fail "docker is installed but the daemon is not reachable." \
    "Start Docker Desktop (or 'sudo service docker start'), wait for it to report running, then retry."
fi

echo "==> Building (the preview server serves dist/ as-is and never rebuilds)"
npm run build

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "==> Pulling $IMAGE (first run only, ~2GB)"
fi

echo "==> Updating baselines in $IMAGE"
# --user keeps the written PNGs owned by the caller rather than root; --ipc=host is
# Playwright's own recommendation, as Chromium exhausts the default 64MB /dev/shm.
# Failures are captured rather than fatal: a run can fail on an assertion *after*
# rewriting some baselines, and the report below is what says which.
status=0
docker run --rm \
  --ipc=host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -v "$PWD":/work \
  -w /work \
  "$IMAGE" \
  npx playwright test "$SPEC_PATH" "$@" --update-snapshots || status=$?

# Playwright leaves this behind on any failure, and a stale copy confuses the next run.
rm -rf test-results

echo ""
echo "==> Baselines changed:"
if git diff --quiet --exit-code -- "$SNAPSHOT_DIR" && [ -z "$(git ls-files --others --exclude-standard -- "$SNAPSHOT_DIR")" ]; then
  echo "  none — every screenshot matched its baseline"
else
  git status --short -- "$SNAPSHOT_DIR"
  echo ""
  echo "  Review them before committing: an unexpected diff is a regression, not a baseline."
fi

if [ "$status" -ne 0 ]; then
  echo ""
  echo "update-visual-snapshots: playwright exited $status — the baselines above may be incomplete." >&2
fi

exit "$status"
