#!/bin/bash
set -ev
echo PWD=$PWD
if [ "${DOCKER}" = "true" ]; then
  # when running inside docker
  echo TRAVIS_PULL_REQUEST=${TRAVIS_PULL_REQUEST}
  if [ "${TRAVIS_PULL_REQUEST}" = "false" ]; then
    echo Not a pull request build. Skipping docker tests and failing the job.
    exit 126
  else
    docker-compose build test
    docker-compose run test npm run build:docker
  fi
else
  # when running outside docker
  cd node_modules/travis-multirunner
  if [ "${TRAVIS_OS_NAME}" == 'linux' ]; then
    BROWSER=chrome ./setup.sh
    BROWSER=firefox ./setup.sh
    export CHROME_BIN=$(pwd)/browsers/bin/chrome-$BVER
    export FIREFOX_BIN=$(pwd)/browsers/bin/firefox-$BVER
  else
    BROWSER=safari ./setup.sh
  fi
  cd ../..
  if [ "${TRAVIS_OS_NAME}" == 'linux' ]; then
    sh -e /etc/init.d/xvfb start
    pulseaudio --start
    sleep 3
  fi
  if [ "${TOPOLOGY}" != 'peer-to-peer' ]; then
    export ENABLE_REST_API_TESTS=1
  fi
  npm run build:travis
fi
