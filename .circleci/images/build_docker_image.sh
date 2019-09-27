#!/bin/bash
# builds container image for integration tests,
# if browser version has changed, pushes the newly generated container to twilio docker hub
# uses: $BROWSER $BVER $CIRCLECI $DOCKER_USERNAME $DOCKER_PASSWORD

# first get the version of current image.
echo "Checking Current version for ${BROWSER}-${BVER}"
# first run ensures that we do not get output from docker pull
docker-compose --file=.circleci/images/docker-compose.yml run --rm getVersion
OLD_VERSION=$(docker-compose --file=.circleci/images/docker-compose.yml run --rm getVersion)
echo "Found old version for ${BROWSER}-${BVER} = ${OLD_VERSION}"

echo "Building new image for ${BROWSER}-${BVER}"
docker-compose --file=.circleci/images/docker-compose.yml build browserContainer

echo "Checking New version for ${BROWSER}-${BVER}"
# first run ensures that we do not get output from docker pull
docker-compose --file=.circleci/images/docker-compose.yml run --rm getVersion
NEW_VERSION=$(docker-compose --file=.circleci/images/docker-compose.yml run --rm getVersion)
echo "Found new version for ${BROWSER}-${BVER} = ${NEW_VERSION}"

if [ "${NEW_VERSION}" == "${OLD_VERSION}" ]; then
    echo "No version change detected. Exiting"
    exit 0
fi

# push newly generated image
if [ "${CIRCLECI}" == "true" ]; then
    echo "Logging in to Docker Hub"
    echo "${DOCKER_PASSWORD}" | docker login --username "${DOCKER_USERNAME}" --password-stdin
fi

echo "Pushing browserContainer image for ${BROWSER}-${BVER}"
docker push twilio/twilio-video-browsers:${BROWSER}-${BVER}
