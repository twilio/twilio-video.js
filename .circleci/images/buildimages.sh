#!/bin/bash

echo building integrationTestContainer image for ${BROWSER}-${BVER}
docker-compose --file=.circleci/images/docker-compose.yml build integrationTestContainer

# once done you can push these tags with:
if [ "${CIRCLECI}" == "true" ]; then
    echo "Docker login"
    echo "${DOCKER_PASSWORD}" | docker login --username "${DOCKER_USERNAME}" --password-stdin
fi

echo pushing integrationTestContainer image for ${BROWSER}-${BVER}
docker push makarandp/twilio-video:${BROWSER}-${BVER}

