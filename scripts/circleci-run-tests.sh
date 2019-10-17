#!/bin/bash
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
echo "running tests"

if [ "${NETWORK_TESTS}" = "true" ];
then
    # network tets run inside a container with docker socket mapped in the container.
    docker-compose --file=.circleci/images/docker-compose.yml run integrationTests
else
    npm run test:integration
fi

echo "Done with Tests!"


