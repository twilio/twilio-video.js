#!/bin/bash

# Builds the integration-test browser images on a developer machine, replacing
# the CircleCI Build-Docker-Test-Image job.
#
# That job relied on two properties of the CircleCI machine executor that do not
# hold on a laptop, so this script restores both:
#
#   - CI always built cache-cold. Docker keys the apt/curl layers on instruction
#     text, which does not change when a browser releases, so a warm local cache
#     silently rebuilds a stale browser. Hence --no-cache.
#   - CI ran on x86_64, and both consumers of these images still do
#     (.github/workflows/e2e.yml, .circleci/config.yml). Builds are pinned to
#     linux/amd64 and the result is asserted before any push.
#
# It also reads the published version by pulling the tag first. Reading it via
# `compose run` alone, as .circleci/images/build_docker_image.sh does, only pulls
# when the image is absent, so locally that reports your previous build rather
# than what is live.
#
# usage:
#   scripts/build-browser-images-local.sh                       # build all 6, report, no push
#   scripts/build-browser-images-local.sh chrome stable         # build one, report, no push
#   scripts/build-browser-images-local.sh --push chrome stable  # build one, then push
#   scripts/build-browser-images-local.sh --push --yes          # build and push all 6, no prompts
#
# Requires a running Docker daemon and amd64 emulation. --push additionally
# requires a `docker login` whose credentials have write access to
# twilio/twilio-video-browsers.
#
# Note: a build tags the image with the shared name, so it replaces whatever copy
# of that tag you had locally whether or not you push.

set -uo pipefail

COMPOSE_FILE=.circleci/images/docker-compose.yml
IMAGE_REPO=twilio/twilio-video-browsers
REQUIRED_PLATFORM=linux/amd64

export DOCKER_DEFAULT_PLATFORM="${REQUIRED_PLATFORM}"

PUSH=false
ASSUME_YES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push) PUSH=true; shift ;;
    --yes|-y) ASSUME_YES=true; shift ;;
    -h|--help) sed -n '3,32p' "$0"; exit 0 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) break ;;
  esac
done

if [[ $# -eq 2 ]]; then
  TARGETS=("$1:$2")
elif [[ $# -eq 0 ]]; then
  TARGETS=(chrome:stable chrome:beta chrome:unstable firefox:stable firefox:beta firefox:unstable)
else
  echo "usage: $0 [--push] [--yes] [browser bver]" >&2
  exit 2
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "error: ${COMPOSE_FILE} not found. Run this from the repository root." >&2
  exit 1
fi

if ! docker info > /dev/null 2>&1; then
  echo "error: cannot reach the Docker daemon. Start Docker Desktop and retry." >&2
  exit 1
fi

# prints the browser version reported by the image currently holding the tag.
# relies on $BROWSER and $BVER being exported by the loop below.
getVersion() {
  docker compose --file="${COMPOSE_FILE}" run --rm getVersion 2>/dev/null \
    | tr -d '\r' | tail -n 1
}

RESULTS=()
FAILED=false

for target in "${TARGETS[@]}"; do
  export BROWSER="${target%%:*}"
  export BVER="${target##*:}"
  TAG="${IMAGE_REPO}:${BROWSER}-${BVER}"

  echo "========================================================="
  echo "${BROWSER}-${BVER}"
  echo "========================================================="

  OLD_VERSION="(not published)"
  if docker pull --quiet "${TAG}" > /dev/null 2>&1; then
    OLD_VERSION=$(getVersion)
  fi
  echo "published: ${OLD_VERSION}"

  echo "building ${TAG} for ${REQUIRED_PLATFORM}, no cache"
  if ! docker compose --file="${COMPOSE_FILE}" build --no-cache browserContainer; then
    echo "build failed"
    RESULTS+=("${BROWSER}-${BVER}: BUILD FAILED")
    FAILED=true
    continue
  fi

  PLATFORM=$(docker image inspect "${TAG}" --format '{{.Os}}/{{.Architecture}}')
  if [[ "${PLATFORM}" != "${REQUIRED_PLATFORM}" ]]; then
    echo "built ${PLATFORM}, but the test runners need ${REQUIRED_PLATFORM}. Not pushing."
    RESULTS+=("${BROWSER}-${BVER}: WRONG PLATFORM (${PLATFORM})")
    FAILED=true
    continue
  fi

  NEW_VERSION=$(getVersion)
  echo "built:     ${NEW_VERSION}"

  if [[ "${PUSH}" != true ]]; then
    RESULTS+=("${BROWSER}-${BVER}: built, not pushed (${NEW_VERSION})")
    continue
  fi

  if [[ "${NEW_VERSION}" == "${OLD_VERSION}" ]]; then
    echo "note: unchanged from what is already published"
  fi

  if [[ "${ASSUME_YES}" != true ]]; then
    read -r -p "push ${TAG}? [y/N] " REPLY < /dev/tty
    if [[ "${REPLY}" != [yY]* ]]; then
      RESULTS+=("${BROWSER}-${BVER}: skipped (${NEW_VERSION})")
      continue
    fi
  fi

  if docker push "${TAG}"; then
    RESULTS+=("${BROWSER}-${BVER}: PUSHED (${NEW_VERSION})")
  else
    echo "push failed. Confirm your login has write access to ${IMAGE_REPO}."
    RESULTS+=("${BROWSER}-${BVER}: PUSH FAILED")
    FAILED=true
  fi
done

echo "========================================================="
echo "summary"
echo "========================================================="
for result in "${RESULTS[@]}"; do
  echo "  ${result}"
done

if [[ "${FAILED}" == true ]]; then
  exit 1
fi
