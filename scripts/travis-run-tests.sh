#!/bin/bash
set -ev
echo $PWD
if [ "${TRAVIS_DOCKER_TESTS}" = "true" ]; then
  docker-compose build test
  docker-compose run test npm run test:integration
else
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
      echo $(which pulseaudio)
      echo pulseaudio --start
      sleep 3
    fi
    if [ "${TOPOLOGY}" != 'peer-to-peer' ]; then
      export ENABLE_REST_API_TESTS=1
    fi
    npm run build:travis
fi
