'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SIP = require('../../sip');

var SIPJSMediaHandler = function () {
  function SIPJSMediaHandler(peerConnectionManager, createMessage) {
    _classCallCheck(this, SIPJSMediaHandler);

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

  _createClass(SIPJSMediaHandler, [{
    key: 'close',
    value: function close() {
      this.peerConnectionManager.close();
    }
  }, {
    key: 'getDescription',
    value: function getDescription() {
      var connectMessage = Object.assign({
        /* eslint camelcase:0 */
        peer_connections: this.peerConnectionManager.getStates()
      }, this.createMessage());
      return Promise.resolve({
        body: JSON.stringify(connectMessage),
        contentType: 'application/room-signaling+json'
      });
    }
  }, {
    key: 'hasDescription',
    value: function hasDescription() {
      return true;
    }
  }, {
    key: 'hold',
    value: function hold() {
      // NOTE(mroberts): We don't use SIP.js's hold functionality.
    }
  }, {
    key: 'isReady',
    value: function isReady() {
      // NOTE(mroberts): We don't use SIP.js's isReady functionality.
      return true;
    }
  }, {
    key: 'isMuted',
    value: function isMuted() {
      // NOTE(mroberts): We don't use SIP.js's isMuted functionality.
      return {
        audio: false,
        video: false
      };
    }
  }, {
    key: 'mute',
    value: function mute() {
      // NOTE(mroberts): We don't use SIP.js's mute functionality.
    }
  }, {
    key: 'render',
    value: function render() {
      // NOTE(mroberts): We don't use SIP.js's render functionality.
    }
  }, {
    key: 'setDescription',
    value: function setDescription(message) {
      var roomState = getRoomState(message);
      if (roomState) {
        var peerConnectionStates = roomState.peer_connections;
        if (peerConnectionStates) {
          return this.peerConnectionManager.update(peerConnectionStates);
        }
      }
      return Promise.resolve();
    }
  }, {
    key: 'unhold',
    value: function unhold() {
      // NOTE(mroberts): We don't use SIP.js's unhold functionality.
    }
  }, {
    key: 'unmute',
    value: function unmute() {
      // NOTE(mroberts): We don't use SIP.js's unmute functionality.
    }
  }, {
    key: 'updateIceServers',
    value: function updateIceServers() {
      // NOTE(mroberts): We don't use SIP.js's ICE server functionality.
    }
  }], [{
    key: 'defaultFactory',
    value: function defaultFactory() {
      // NOTE(mroberts): We don't use SIP.js's defaultFactory functionality.
    }
  }]);

  return SIPJSMediaHandler;
}();

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