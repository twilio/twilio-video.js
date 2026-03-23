FROM cimg/node:lts

ARG BVER=stable

ENV BROWSER='chrome'
ENV BVER=${BVER}

USER root

# Add Google Chrome repository using modern key management
RUN wget -q -O /tmp/google-chrome.asc https://dl-ssl.google.com/linux/linux_signing_key.pub \
  && install -D -o root -g root -m 644 /tmp/google-chrome.asc /etc/apt/keyrings/google-chrome.asc \
  && echo "deb [signed-by=/etc/apt/keyrings/google-chrome.asc] http://dl.google.com/linux/chrome/deb/ stable main" \
     > /etc/apt/sources.list.d/google-chrome.list \
  && rm /tmp/google-chrome.asc

# Install Chrome and dependencies in a single apt-get update
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     google-chrome-${BVER} \
     xvfb libgbm-dev libgbm1 libgtk-3-0t64 libnotify-dev libnss3 libxss1 libasound2t64 libxtst6 xauth \
     dbus dbus-x11 \
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

LABEL com.circleci.preserve-entrypoint=true

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["bash"]
