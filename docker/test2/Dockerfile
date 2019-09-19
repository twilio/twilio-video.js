# https://hub.docker.com/r/browserless/chrome/dockerfile/
FROM circleci/node:lts-browsers


# It's a good idea to use dumb-init to help prevent zombie chrome processes.
# ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 /usr/local/bin/dumb-init
# RUN chmod +x /usr/local/bin/dumb-init

ADD ./ /opt/app
WORKDIR /opt/app
# RUN npm install

# Build Args
ARG USE_BROWSER='firefox'
ARG USE_BVER='unstable'
ARG USE_NETWORK='docker_network_was_not_specified'

ENV ENABLE_REST_API_TESTS=1

# Configuration for Chrome
ENV CONNECTION_TIMEOUT=60000

# install selected browser / version
ENV BROWSER=$USE_BROWSER
ENV BVER=$USE_BVER
ENV DOCKER_NETWORK=$USE_NETWORK
# RUN cd node_modules/travis-multirunner && ./setup.sh && cd /opt/app
# ENV CHROME_BIN=/opt/app/node_modules/travis-multirunner/browsers/bin/chrome-${BVER}
# ENV FIREFOX_BIN=/opt/app/node_modules/travis-multirunner/browsers/bin/firefox-${BVER}

# ENTRYPOINT ["dumb-init"]

# specify default command to run container w/o arguments.
CMD ["bash"]
