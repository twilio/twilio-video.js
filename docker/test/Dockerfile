# https://hub.docker.com/r/browserless/chrome/dockerfile/
FROM ubuntu:18.04

# Dependencies + NodeJS
RUN apt-get -qq update && \
  echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections && \
  apt-get -y -qq install software-properties-common &&\
  apt-add-repository "deb http://archive.canonical.com/ubuntu $(lsb_release -sc) partner" && \
  apt-add-repository ppa:malteworld/ppa && apt-get -qq update && apt-get -y -qq install \
  libappindicator3-1 \
  pdftk \
  unzip \
  locales \
  gconf-service \
  libasound2 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgcc1 \
  libgconf-2-4 \
  libgdk-pixbuf2.0-0 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  ca-certificates \
  libappindicator1 \
  libnss3 \
  lsb-release \
  xdg-utils \
  wget \
  xvfb \
  iproute2 \
  curl &&\
  # Install Node
  curl --silent --location https://deb.nodesource.com/setup_10.x | bash - &&\
  apt-get -y -qq install nodejs &&\
  apt-get -y -qq install build-essential

# It's a good idea to use dumb-init to help prevent zombie chrome processes.
ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init

ADD ./ /opt/app
WORKDIR /opt/app
RUN npm install

# Build Args
ARG USE_BROWSER='firefox'
ARG USE_BVER='unstable'

ENV ENABLE_REST_API_TESTS=1

# Configuration for Chrome
ENV CONNECTION_TIMEOUT=60000

# install selected browser / version
ENV BROWSER=$USE_BROWSER
ENV BVER=$USE_BVER
RUN cd node_modules/travis-multirunner && ./setup.sh && cd /opt/app
ENV CHROME_BIN=/opt/app/node_modules/travis-multirunner/browsers/bin/chrome-${BVER}
ENV FIREFOX_BIN=/opt/app/node_modules/travis-multirunner/browsers/bin/firefox-${BVER}

ENTRYPOINT ["dumb-init"]
