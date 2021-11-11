#!/bin/bash

# NOTE(mpatwardhan): IMPORTANT - Since CircleCi logs are publicly available,
# DO NOT echo or printenv or in any other way let the sensitive environment variables
# get printed or saved.

set -ev

echo "current directory:"
echo $PWD
echo "node version:"
node --version
echo "npm version:"
npm --version
echo "os info:"
uname -a
echo "directory:"
ls -alt
echo "Package.json version:"
cat package.json | grep version
echo "Test files:"
echo $TEST_FILES

echo "Installing dependancies"

# install dependancies.
npm install --no-optional --legacy-peer-deps

echo "Building Project"
# build the project.
npm run build:es5

echo "Running Tests"
# Run node directly (instead of running npm run test:integration)
# because npm run launches node using different user account than current one (root)
# For network tests we launch DockerProxyServer, which accesses /var/run/docker.sock
# it needs root access.
node ./scripts/karma.js karma/integration.conf.js
echo "Done"
