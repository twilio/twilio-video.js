#!/bin/bash
set -ev
echo PWD=$PWD

echo "node version:"
node --version
echo "npm version:"
npm --version
echo "os info:"
uname -a
echo "directory:"
ls -alt
echo "printenv"
printenv | grep -v SID | grep -v KEY
echo "running tests"

if [ "${DOCKER}" = "true" ];
then
    docker-compose --file=.circleci/images/docker-compose.yml build circleci
    docker-compose --file=.circleci/images/docker-compose.yml run circleci npm run build:installandTest
else
    npm run test:integration
fi

mkdir logs
echo 'test results go here!' >> logs/results.txt


