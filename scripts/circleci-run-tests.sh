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

case ${ENVIRONMENT} in
dev)
  echo "Testing against dev"
  export ACCOUNT_SID=${ACCOUNT_SID_DEV}
  export API_KEY_SECRET=${API_KEY_SECRET_DEV}
  export API_KEY_SID=${API_KEY_SID_DEV}
  export REGIONS='us1'
  export ECS_SERVER=https://ecs.dev-us1.twilio.com
  export WS_SERVER_INSIGHTS=wss://sdkgw.dev-us1.twilio.com/v1/VideoEvents
  export CONFIGURATION_PROFILE_SID_P2P=${CONFIGURATION_PROFILE_SID_P2P_DEV}
  export CONFIGURATION_PROFILE_SID_SFU=${CONFIGURATION_PROFILE_SID_SFU_DEV}
  ;;
stage)
  echo "Testing against stage"
  export ACCOUNT_SID=${ACCOUNT_SID_STAGE}
  export API_KEY_SECRET=${API_KEY_SECRET_STAGE}
  export API_KEY_SID=${API_KEY_SID_STAGE}
  export REGIONS='au1,ie1,us1'
  export ECS_SERVER=https://ecs.stage-us1.twilio.com
  export WS_SERVER_INSIGHTS=wss://sdkgw.stage-us1.twilio.com/v1/VideoEvents
  export CONFIGURATION_PROFILE_SID_P2P=${CONFIGURATION_PROFILE_SID_P2P_STAGE}
  export CONFIGURATION_PROFILE_SID_SFU=${CONFIGURATION_PROFILE_SID_SFU_STAGE}
  ;;
prod)
  echo "Testing against prod"
  export ACCOUNT_SID=${ACCOUNT_SID_PROD}
  export API_KEY_SECRET=${API_KEY_SECRET_PROD}
  export API_KEY_SID=${API_KEY_SID_PROD}
  export CONFIGURATION_PROFILE_SID_P2P=${CONFIGURATION_PROFILE_SID_P2P_PROD}
  export CONFIGURATION_PROFILE_SID_SFU=${CONFIGURATION_PROFILE_SID_SFU_PROD}
  ;;
*)
  echo 'Please specify ENVIRONMENT ("dev", "stage", or "prod")'
  exit 1
  ;;
esac

if [ "${NETWORK_TESTS}" = "true" ];
then
    # network tets run inside a container with docker socket mapped in the container.
    docker-compose --file=.circleci/images/docker-compose.yml run integrationTests
else
    # ask circleci to split tests by timing.
    echo "Asking circleci to pick tests based on timings..."
    export TEST_FILES=$(circleci tests glob "$PWD/test/integration/spec/**/*.js" | circleci tests split --split-by=timings)
    echo $TEST_FILES
    npm run test:integration
fi

echo "Done with Tests!"


