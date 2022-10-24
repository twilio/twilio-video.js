# https://hub.docker.com/r/browserless/chrome/dockerfile/
FROM cimg/node:lts

# install selected browser / version
ENV BROWSER='chrome'
ENV BVER='stable'

# Switch to user - root
USER root

# Install and enable iptables
RUN echo "Setting up iptables..." &&\
echo "Installing Chrome: $BVER" &&\
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - &&\
echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list &&\
apt-get update &&\
echo "Installing iproute2 from apt-get" &&\
apt-get install -y iproute2 &&\
echo "Installing google-chrome-$BVER from apt-get" &&\
apt-get install -y google-chrome-$BVER &&\
rm -rf /var/lib/apt/lists/* &&\
apt-get install -y iptables &&\
adduser user1 &&\
adduser user1 sudo &&\
su - user1

# Switch back to user - circleci
USER circleci

# specify default command to run container w/o arguments.
CMD ["bash"]
