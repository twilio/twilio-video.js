#!/bin/bash

echo building chrome stable...
BROWSER=chrome BVER=stable docker-compose build integrationTestContainer
BROWSER=chrome BVER=stable docker-compose run integrationTestContainer printenv

echo building chrome beta...
BROWSER=chrome BVER=beta docker-compose build integrationTestContainer

echo building chrome unstable...
BROWSER=chrome BVER=unstable docker-compose build integrationTestContainer

echo building Firefox stable...
BROWSER=firefox BVER=stable docker-compose build integrationTestContainer

echo building Firefox beta...
BROWSER=firefox BVER=beta docker-compose build integrationTestContainer

echo building Firefox unstable...
BROWSER=firefox BVER=unstable docker-compose build integrationTestContainer

# once done you can push these tags with:
docker push makarandp/twilio-video:chrome-stable
docker push makarandp/twilio-video:chrome-beta
docker push makarandp/twilio-video:chrome-unstable
docker push makarandp/twilio-video:firefox-stable
docker push makarandp/twilio-video:firefox-beta
docker push makarandp/twilio-video:firefox-unstable

