FROM cimg/node:lts

ARG BVER=stable

ENV BROWSER='firefox'
ENV BVER=${BVER}
ENV FIREFOX_BIN=/opt/firefox/firefox

USER root

# Map BVER to Mozilla download product string and install Firefox
RUN if [ "${BVER}" = "stable" ]; then \
      PRODUCT="firefox-latest-ssl"; \
    elif [ "${BVER}" = "beta" ]; then \
      PRODUCT="firefox-beta-latest-ssl"; \
    elif [ "${BVER}" = "unstable" ]; then \
      PRODUCT="firefox-nightly-latest-ssl"; \
    else \
      echo "Unknown BVER: ${BVER}" && exit 1; \
    fi \
  && FIREFOX_URL="https://download.mozilla.org/?product=${PRODUCT}&os=linux64&lang=en-US" \
  && ACTUAL_URL=$(curl -Ls -o /dev/null -w %{url_effective} "${FIREFOX_URL}") \
  && curl --silent --show-error --location --fail --retry 3 --output /tmp/firefox.tar "${ACTUAL_URL}" \
  && tar -xf /tmp/firefox.tar -C /opt \
  && ln -s /opt/firefox/firefox /usr/local/bin/firefox \
  && rm -f /tmp/firefox.tar

# Install all dependencies in a single apt-get update
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     xvfb libgbm-dev libgbm1 libgtk-3-0t64 libnotify-dev libnss3 libxss1 libasound2t64 libxtst6 xauth \
     dbus dbus-x11 libdbus-glib-1-2 libdbus-1-3 \
     libatk-bridge2.0-0t64 libcups2t64 libxcomposite1 libxdamage1 libxrandr2 \
  && if [ "${BVER}" = "stable" ]; then \
       apt-get install -y --no-install-recommends iptables iproute2; \
     fi \
  && rm -rf /var/lib/apt/lists/*

# Pre-create dbus directory
RUN mkdir -p /run/dbus && chmod 755 /run/dbus

USER circleci

# Start dbus and Xvfb automatically
ENV DISPLAY=:99
RUN printf '#!/bin/sh\nset -e\nsudo dbus-daemon --system --fork 2>/dev/null || true\nXvfb :99 -screen 0 1280x1024x24 &\nsleep 1\nexec "$@"\n' > /tmp/entrypoint \
  && chmod +x /tmp/entrypoint \
  && sudo mv /tmp/entrypoint /docker-entrypoint.sh

# Verify firefox installed correctly
RUN firefox --version

LABEL com.circleci.preserve-entrypoint=true

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["bash"]
