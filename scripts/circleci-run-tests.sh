#!/bin/bash
set -ev
echo PWD=$PWD
docker-compose build test
docker-compose run test npm run test:integration

