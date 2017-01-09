'use strict';

var SIP = require('../../sip');

function SIPJSMediaHandler(peerConnectionManager, createMessage) {
  if (!(this instanceof SIPJSMediaHandler)) {
    return new SIPJSMediaHandler(peerConnectionManager);
  }
  Object.defineProperties(this, {
    createMessage: {
      enumerable: true,
      value: createMessage
    },
    peerConnectionManager: {
      enumerable: true,
      value: peerConnectionManager
    }
  });
}

SIPJSMediaHandler.defaultFactory = function defaultFactory() {
  // NOTE(mroberts): We don't use SIP.js's defaultFactory functionality.
};

SIPJSMediaHandler.defaultFactory.isSupported = function isSupported() {
  return SIP.WebRTC.isSupported();
};

SIPJSMediaHandler.prototype.close = function close() {
  this.peerConnectionManager.close();
};

SIPJSMediaHandler.prototype.getDescription = function getDescription() {
  var connectMessage = Object.assign({
    /* eslint camelcase:0 */
    peer_connections: this.peerConnectionManager.getStates()
  }, this.createMessage());
  return Promise.resolve({
    body: JSON.stringify(connectMessage),
    contentType: 'application/room-signaling+json'
  });
};

SIPJSMediaHandler.prototype.hasDescription = function hasDescription() {
  return true;
};

SIPJSMediaHandler.prototype.hold = function hold() {
  // NOTE(mroberts): We don't use SIP.js's hold functionality.
};

SIPJSMediaHandler.prototype.isReady = function isReady() {
  // NOTE(mroberts): We don't use SIP.js's isReady functionality.
  return true;
};

SIPJSMediaHandler.prototype.isMuted = function isMuted() {
  // NOTE(mroberts): We don't use SIP.js's isMuted functionality.
  return {
    audio: false,
    video: false
  };
};

SIPJSMediaHandler.prototype.mute = function mute() {
  // NOTE(mroberts): We don't use SIP.js's mute functionality.
};

SIPJSMediaHandler.prototype.render = function render() {
  // NOTE(mroberts): We don't use SIP.js's render functionality.
};

SIPJSMediaHandler.prototype.setDescription = function setDescription(message) {
  var roomState = getRoomState(message);
  if (roomState) {
    var peerConnectionStates = roomState.peer_connections;
    if (peerConnectionStates) {
      return this.peerConnectionManager.update(peerConnectionStates);
    }
  }
  return Promise.resolve();
};

SIPJSMediaHandler.prototype.unhold = function unhold() {
  // NOTE(mroberts): We don't use SIP.js's unhold functionality.
};

SIPJSMediaHandler.prototype.unmute = function unmute() {
  // NOTE(mroberts): We don't use SIP.js's unmute functionality.
};

SIPJSMediaHandler.prototype.updateIceServers = function updateIceServers() {
  // NOTE(mroberts): We don't use SIP.js's ICE server functionality.
};

function getRoomState(message) {
  try {
    return JSON.parse(message.body);
  } catch (error) {
    return null;
  }
}

module.exports = SIPJSMediaHandler;
