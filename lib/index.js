'use strict';

function Conversations(accessToken, options) {
  return new Conversations.Endpoint(accessToken, options);
}

Object.defineProperties(Conversations, {
  AccessToken: {
    enumerable: true,
    value: require('./accesstoken')
  },
  Endpoint: {
    enumerable: true,
    value: require('./endpoint')
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
