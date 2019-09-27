#!/bin/bash
echo building browserContainer image for ${BROWSER}-${BVER} using ${DOCKER_USERNAME}
docker-compose --file=.circleci/images/docker-compose.yml build browserContainer

# once done you can push these tags with:
if [ "${CIRCLECI}" == "true" ]; then
    echo "Docker login"
    echo "${DOCKER_PASSWORD}" | docker login --username "${DOCKER_USERNAME}" --password-stdin
fi

echo pushing browserContainer image for ${BROWSER}-${BVER}
docker push twilio/twilio-video-browsers:${BROWSER}-${BVER}

