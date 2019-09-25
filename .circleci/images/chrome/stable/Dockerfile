# https://hub.docker.com/r/browserless/chrome/dockerfile/
FROM circleci/node:lts-browsers

# Configuration for Chrome
ENV CONNECTION_TIMEOUT=60000

# install selected browser / version
ENV BROWSER='chrome'
ENV BVER='stable'
ENV ENABLE_REST_API_TESTS=1

# specify default command to run container w/o arguments.
CMD ["bash"]
