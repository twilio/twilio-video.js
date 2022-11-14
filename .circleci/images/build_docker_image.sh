#!/bin/bash
# builds container image for integration tests,
# if browser version has changed, pushes the newly generated container to twilio docker hub
# uses: $BROWSER $BVER $CIRCLECI $DOCKER_USERNAME $DOCKER_PASSWORD

echo "current directory:"
echo $PWD

mkdir -p ./logs

# first get the version of current image.
echo "Checking Current version for ${BROWSER}-${BVER}"
# first run ensures that we do not get output from docker pull
docker-compose --file=.circleci/images/docker-compose.yml run --rm getVersion
OLD_VERSION=$(docker-compose --file=.circleci/images/docker-compose.yml run --rm getVersion)
echo "========================================================="
echo "Found old version for ${BROWSER}-${BVER} = ${OLD_VERSION}"
echo "========================================================="
echo ${OLD_VERSION} > ./logs/oldversion.txt

echo "Building new image for ${BROWSER}-${BVER}"
docker-compose --file=.circleci/images/docker-compose.yml build browserContainer

echo "Checking New version for ${BROWSER}-${BVER}"
# first run ensures that we do not get output from docker pull
docker-compose --file=.circleci/images/docker-compose.yml run --rm getVersion
NEW_VERSION=$(docker-compose --file=.circleci/images/docker-compose.yml run --rm getVersion)
echo "========================================================="
echo "Found new version for ${BROWSER}-${BVER} = ${NEW_VERSION}"
echo "========================================================="
echo ${NEW_VERSION} > ./logs/newversion.txt

# if [ "${NEW_VERSION}" == "${OLD_VERSION}" ]; then
#     echo "========================================================="
#     echo "No version change detected. Exiting"
#     echo "========================================================="
#     echo notpushed > ./logs/notpushed.txt
#     SLACK_MESSAGE_TEXT="${BROWSER}-${BVER} is ${NEW_VERSION}"
#     CLEANEDUP_SLACK_MESSAGE_TEXT=$(echo $SLACK_MESSAGE_TEXT|tr -d '\n\r\t')
#     curl -X POST -H 'Content-type: application/json' --data '{"text": '\""$CLEANEDUP_SLACK_MESSAGE_TEXT"\"'}' $SLACK_WEBHOOK
#     exit 0
# fi

# push newly generated image
if [ "${CIRCLECI}" == "true" ]; then
    echo "Logging in to Docker Hub"
    echo "${DOCKER_HUB_PASSWORD}" | docker login --username "${DOCKER_HUB_USERNAME}" --password-stdin
fi

echo "Pushing browserContainer image for ${BROWSER}-${BVER}"
docker push twilio/twilio-video-browsers:${BROWSER}-${BVER}
echo pushed > ./logs/pushed.txt
SLACK_MESSAGE_TEXT="Updated: ${BROWSER}-${BVER} => ${NEW_VERSION}"
CLEANEDUP_SLACK_MESSAGE_TEXT=$(echo $SLACK_MESSAGE_TEXT|tr -d '\n\r\t')
curl -X POST -H 'Content-type: application/json' --data '{"text": '\""$CLEANEDUP_SLACK_MESSAGE_TEXT"\"'}' $SLACK_WEBHOOK

echo "========================================================="
echo "Done Pushing browserContainer image for ${BROWSER}-${BVER}"
echo "========================================================="
