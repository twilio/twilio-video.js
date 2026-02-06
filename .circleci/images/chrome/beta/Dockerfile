FROM cimg/node:current-browsers

USER root
ENV BROWSER='chrome'
ENV BVER='beta'

RUN echo $(whoami)
RUN echo "Installing Chrome: $BVER" \
&& wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
&& echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
&& apt-get update \
&& echo "Installing google-chrome-$BVER from apt-get" \
&& apt-get install -y google-chrome-$BVER \
&& echo "Installing xvfb from apt-get" \
# cypress testing dependencies
&& apt-get install -y xvfb libgbm-dev libgbm1 libgtk-3-0t64 libnotify-dev libnss3 libxss1 libasound2t64 libxtst6 xauth \
    dbus dbus-x11 \
&& rm -rf /var/lib/apt/lists/*

# Pre-create dbus directory at build time (as root)
RUN mkdir -p /run/dbus && chmod 755 /run/dbus

# start dbus and xvfb automatically to avoid needing to express in circle.yml
ENV DISPLAY :99
RUN printf '#!/bin/sh\ndbus-daemon --system --fork 2>/dev/null || true\nXvfb :99 -screen 0 1280x1024x24 &\nsleep 1\nexec "$@"\n' > /tmp/entrypoint \
  && chmod +x /tmp/entrypoint \
        && sudo mv /tmp/entrypoint /docker-entrypoint.sh

# ensure that the build agent doesn't override the entrypoint
LABEL com.circleci.preserve-entrypoint=true

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["bash"]
