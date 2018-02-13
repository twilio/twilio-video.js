'use strict';

const SIP = require('../../sip');

class SIPJSMediaHandler {
  constructor(peerConnectionManager, createMessage) {
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

  static defaultFactory() {
    // NOTE(mroberts): We don't use SIP.js's defaultFactory functionality.
  }

  close() {
    this.peerConnectionManager.close();
  }

  getDescription() {
    const connectMessage = Object.assign({
      /* eslint camelcase:0 */
      peer_connections: this.peerConnectionManager.getStates()
    }, this.createMessage());
    return Promise.resolve({
      body: JSON.stringify(connectMessage),
      contentType: 'application/room-signaling+json'
    });
  }

  hasDescription() {
    return true;
  }

  hold() {
    // NOTE(mroberts): We don't use SIP.js's hold functionality.
  }

  isReady() {
    // NOTE(mroberts): We don't use SIP.js's isReady functionality.
    return true;
  }

  isMuted() {
    // NOTE(mroberts): We don't use SIP.js's isMuted functionality.
    return {
      audio: false,
      video: false
    };
  }

  mute() {
    // NOTE(mroberts): We don't use SIP.js's mute functionality.
  }

  render() {
    // NOTE(mroberts): We don't use SIP.js's render functionality.
  }

  setDescription(message) {
    const roomState = getRoomState(message);
    if (roomState) {
      const peerConnectionStates = roomState.peer_connections;
      if (peerConnectionStates) {
        return this.peerConnectionManager.update(peerConnectionStates);
      }
    }
    return Promise.resolve();
  }

  unhold() {
    // NOTE(mroberts): We don't use SIP.js's unhold functionality.
  }

  unmute() {
    // NOTE(mroberts): We don't use SIP.js's unmute functionality.
  }

  updateIceServers() {
    // NOTE(mroberts): We don't use SIP.js's ICE server functionality.
  }
}

SIPJSMediaHandler.defaultFactory.isSupported = function isSupported() {
  return SIP.WebRTC.isSupported();
};

function getRoomState(message) {
  try {
    return JSON.parse(message.body);
  } catch (error) {
    return null;
  }
}

module.exports = SIPJSMediaHandler;
