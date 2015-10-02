'use strict';

function Conversations(accessToken, options) {
  return new Conversations.Client(accessToken, options);
}

Object.defineProperties(Conversations, {
  AccessToken: {
    enumerable: true,
    value: require('./accesstoken')
  },
  Client: {
    enumerable: true,
    value: require('./client')
  },
  getUserMedia: {
    enumerable: true,
    value: require('./webrtc/getusermedia')
  },
  LocalMedia: {
    enumerable: true,
    value: require('./media/localmedia')
  }
});

module.exports = Conversations;
