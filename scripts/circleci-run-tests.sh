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
echo "running tests"

case ${ENVIRONMENT} in
dev)
  echo "Testing against dev"
  export ACCOUNT_SID=${ACCOUNT_SID_DEV}
  export API_KEY_SECRET=${API_KEY_SECRET_DEV}
  export API_KEY_SID=${API_KEY_SID_DEV}
  export REGIONS='us1'
  ;;
stage)
  echo "Testing against stage"
  export ACCOUNT_SID=${ACCOUNT_SID_STAGE}
  export API_KEY_SECRET=${API_KEY_SECRET_STAGE}
  export API_KEY_SID=${API_KEY_SID_STAGE}
  export REGIONS='au1,ie1,us1'
  ;;
prod)
  echo "Testing against prod"
  export ACCOUNT_SID=${ACCOUNT_SID_PROD}
  export API_KEY_SECRET=${API_KEY_SECRET_PROD}
  export API_KEY_SID=${API_KEY_SID_PROD}
  ;;
*)
  echo 'Please specify ENVIRONMENT ("dev", "stage", or "prod")'
  exit 1
  ;;
esac

if [ "${NETWORK_TESTS}" = "true" ];
then
    # network tets run inside a container with docker socket mapped in the container.
    echo "${DOCKER_PASSWORD}" | docker login --username "${DOCKER_USERNAME}" --password-stdin
    docker-compose --file=.circleci/images/docker-compose.yml run integrationTests
else
    # ask circleci to split tests by timing.
    echo "Asking circleci to pick tests based on timings..."
    export TEST_FILES=$(circleci tests glob "$PWD/test/integration/spec/**/*.js" | circleci tests split --split-by=timings)
    echo $TEST_FILES
    npm run test:integration
fi

echo "Done with Tests!"

