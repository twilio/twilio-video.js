#!/bin/bash
set -ev
echo PWD=$PWD
cd node_modules/travis-multirunner
if [ "${TRAVIS_OS_NAME}" == 'linux' ]; then
  # Upgrade to dpkg >= 1.17.5ubuntu5.8, which fixes
  # https://bugs.launchpad.net/ubuntu/+source/dpkg/+bug/1730627
  # (https://github.com/travis-ci/travis-ci/issues/9361)
  sudo apt-get install -y dpkg
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
