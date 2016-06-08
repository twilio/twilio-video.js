'use strict';

var ConversationInfo = require('../conversation-info');
var inherits = require('util').inherits;
var PeerConnectionManager = require('./peerconnectionmanager');
var QueueingEventEmitter = require('../../queueingeventemitter');
var SIP = require('sip.js');

function SIPJSMediaHandler(peerConnectionManager) {
  if (!(this instanceof SIPJSMediaHandler)) {
    return new SIPJSMediaHandler(peerConnectionManager);
  }
  QueueingEventEmitter.call(this);
  peerConnectionManager = peerConnectionManager || new PeerConnectionManager();
  Object.defineProperties(this, {
    peerConnectionManager: {
      enumerable: true,
      value: peerConnectionManager
    }
  });
}

inherits(SIPJSMediaHandler, QueueingEventEmitter);

SIPJSMediaHandler.defaultFactory = function defaultFactory() {
  return new SIPJSMediaHandler(new PeerConnectionManager());
};

SIPJSMediaHandler.defaultFactory.isSupported = function isSupported() {
  return SIP.WebRTC.isSupported();
};

SIPJSMediaHandler.prototype.close = function close() {
  this.peerConnectionManager.close();
};

SIPJSMediaHandler.prototype.getDescription = function getDescription() {
  var conversationInfo = this.peerConnectionManager.getConversationInfo();
  this.peerConnectionManager.update();
  return Promise.resolve({
    body: JSON.stringify(conversationInfo),
    contentType: 'application/conversation-info+json'
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
  var conversationInfo = getConversationInfo(message);
  if (conversationInfo) {
    this.queue('conversationInfo', conversationInfo);
  }
  return this.peerConnectionManager.update(conversationInfo);
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

function getConversationInfo(message) {
  if (message.getHeader('Content-Type') !==
    'application/conversation-info+json') {
    return null;
  }
  try {
    return ConversationInfo.parseNotification(message.body);
  } catch (error) {
    return null;
  }
}

module.exports = SIPJSMediaHandler;
