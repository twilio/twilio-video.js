FROM cimg/node:current-browsers

#
# Install Java 11 LTS / OpenJDK 11 and dependencies
#
RUN sudo apt-get update && \
	sudo apt-get install -y openjdk-11-jre openjdk-11-jre-headless openjdk-11-jdk openjdk-11-jdk-headless && \
	sudo apt-get install -y bzip2 xvfb libgbm-dev libgbm1 libnotify-dev libnss3 libxss1 libxtst6 xauth && \
	(sudo apt-get install -y libgtk-3-0 libasound2 || sudo apt-get install -y libgtk-3-0t64 libasound2t64) # for extracting firefox, running chrome, and cypress testing dependencies

#
# install firefox
#
RUN FIREFOX_URL="https://download.mozilla.org/?product=firefox-latest-ssl&os=linux64&lang=en-US" \
  && ACTUAL_URL=$(curl -Ls -o /dev/null -w %{url_effective} $FIREFOX_URL) \
  && curl --silent --show-error --location --fail --retry 3 --output /tmp/firefox.tar.bz2 $ACTUAL_URL \
  && sudo tar -xvjf /tmp/firefox.tar.bz2 -C /opt \
  && sudo ln -s /opt/firefox/firefox /usr/local/bin/firefox \
  && sudo apt-get update \
  && sudo apt-get install -y libdbus-glib-1-2 libdbus-1-3 \
  && rm -rf /tmp/firefox.* \
  && firefox --version

ENV BROWSER='firefox'
ENV BVER='stable'
ENV FIREFOX_BIN=/opt/firefox/firefox

# Switch to user - root
USER root

# Install and enable iptables
RUN echo "Setting up iptables..." &&\
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - &&\
apt-get update &&\
apt-get install -y iproute2 &&\
apt-get install -y iptables &&\
ldconfig &&\
echo "Checking libgbm:" && ls -la /usr/lib/x86_64-linux-gnu/libgbm* || echo "libgbm not found in /usr/lib/x86_64-linux-gnu" &&\
find /usr -name "libgbm*" 2>/dev/null &&\
adduser user1 &&\
adduser user1 sudo &&\
su - user1

# Switch back to user - circleci
USER circleci

# start xvfb automatically to avoid needing to express in circle.yml
ENV DISPLAY :99
RUN printf '#!/bin/sh\nXvfb :99 -screen 0 1280x1024x24 &\nexec "$@"\n' > /tmp/entrypoint \
  && chmod +x /tmp/entrypoint \
        && sudo mv /tmp/entrypoint /docker-entrypoint.sh

# ensure that the build agent doesn't override the entrypoint
LABEL com.circleci.preserve-entrypoint=true

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["bash"]
