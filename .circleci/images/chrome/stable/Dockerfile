# https://hub.docker.com/r/browserless/chrome/dockerfile/
FROM circleci/node:lts-browsers

# install selected browser / version
ENV BROWSER='chrome'
ENV BVER='stable'

# Switch to user - root
USER root

# Install and enable iptables
RUN echo "Setting up iptables..." &&\
apt-get update &&\
apt-get install -y iptables &&\
adduser user1 &&\
adduser user1 sudo &&\
su - user1

# Switch back to user - circleci
USER circleci

# specify default command to run container w/o arguments.
CMD ["bash"]
