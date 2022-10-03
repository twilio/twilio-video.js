FROM cimg/node:lts

#
# Install Java 11 LTS / OpenJDK 11
#
RUN if grep -q Debian /etc/os-release && grep -q stretch /etc/os-release; then \
		echo 'deb http://deb.debian.org/debian stretch-backports main' | sudo tee -a /etc/apt/sources.list.d/stretch-backports.list; \
	elif grep -q Ubuntu /etc/os-release && grep -q xenial /etc/os-release; then \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - &&\
		sudo apt-get update && sudo apt-get install -y software-properties-common && \
		sudo add-apt-repository -y ppa:openjdk-r/ppa; \
	fi && \
	sudo apt-get update && sudo apt-get install -y openjdk-11-jre openjdk-11-jre-headless openjdk-11-jdk openjdk-11-jdk-headless && \
	sudo apt-get install -y bzip2 libgconf-2-4 # for extracting firefox and running chrome, respectively

#
# install firefox
#
RUN FIREFOX_URL="https://download.mozilla.org/?product=firefox-latest-ssl&os=linux64&lang=en-US" \
  && ACTUAL_URL=$(curl -Ls -o /dev/null -w %{url_effective} $FIREFOX_URL) \
  && curl --silent --show-error --location --fail --retry 3 --output /tmp/firefox.tar.bz2 $ACTUAL_URL \
  && sudo tar -xvjf /tmp/firefox.tar.bz2 -C /opt \
  && sudo ln -s /opt/firefox/firefox /usr/local/bin/firefox \
  && sudo apt-get install -y libgtk3.0-cil-dev libasound2 libasound2 libdbus-glib-1-2 libdbus-1-3 \
  && rm -rf /tmp/firefox.* \
  && firefox --version

ENV BROWSER='firefox'
ENV BVER='stable'
ENV FIREFOX_BIN=/opt/firefox/firefox

# Switch to user - root
USER root

# Install and enable iptables
RUN echo "Setting up iptables..." &&\
apt-get update &&\
apt-get install -y iptables &&\
sudo apt-get install -y xvfb &&\
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
CMD ["/bin/sh"]
