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
printenv
# docker-compose build test
# docker-compose run test npm run test:integration

mkdir logs
echo 'test results go here!' >> logs/results.txt


