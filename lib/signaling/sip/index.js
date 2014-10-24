'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var constants = require('../../constants');
var calls = require('../../calls');
var IncomingCall = calls.IncomingCall;
var OutgoingCall = calls.OutgoingCall;
var SipUA = require('./sipua');
var util = require('../../util');

// Defaults
var DEBUG = false;
var UA = require('sip.js').UA;
var WS_SERVER = constants.WS_SERVER;

var instance = null;

/**
 * Constructs a new {@link SipUAFactory}.
 * @class
 * @classdesc {@link SipUAFactory} is a singleton for creating {@link SipUA}s,
 *   used by {@link Peer}s to make calls.
 * @property {Array<Peer>} peers - the {@link Peer}s which have active {@link
 *   SipUA}s created by this {@link SipUAFactory}
 * @property {Array<SipUA>} uas - the active {@link SipUA}s created by this
 *   {@link SipUAFactory}
 */
function SipUAFactory(options) {
  if (!(this instanceof SipUAFactory)) {
    return new SipUAFactory(options);
  }

  EventEmitter.call(this);

  console.log(options);

  options = options || {};
  var debug    = 'debug'    in options ? options['debug']    : DEBUG;
  var encrypt  = 'encrypt'  in options ? options['encrypt']  : true;
  var ua       = 'UA'       in options ? options['UA']       : UA;
  var wsServer = 'ws' + (encrypt ? 's' : '') + '://'
               + ('wsServer' in options ? options['wsServer'] : WS_SERVER);
  var self = this;
  Object.defineProperties(this, {
    // Private
    _debug: {
      value: debug
    },
    _peers: {
      value: {}
    },
    _sipuas: {
      value: {}
    },
    _UA: {
      value: ua
    },
    _wsServer: {
      value: wsServer
    },
    // Public
    'peers': {
      get: function() {
        return util.getKeys(self._peers);
      }
    },
    'uas': {
      get: function() {
        return util.getValues(self._sipuas);
      }
    }
  });

  return Object.freeze(this);
}

inherits(SipUAFactory, EventEmitter);

SipUAFactory.getInstance = function getInstance(options) {
  return instance || (instance = new SipUAFactory(options));
};

SipUAFactory.reset = function reset() {
  if (instance) {
    instance.uas.forEach(function(sipua) {
      sipua.close();
    });
    instance = null;
  }
};

SipUAFactory.prototype.reset = SipUAFactory.reset;

/**
 * Create a new {@link SipUA} for the given {@link Peer}.
 * @instance
 * @param {Peer} peer - the {@link Peer} to create a {@link SipUA} for
 * @returns {SipUA}
 */
SipUAFactory.prototype.addPeer = function addPeer(peer) {
  if (this._peers[peer.uuid]) {
    throw new Error('Peer ' + peer.uuid + ' already present on SipUAFactory');
  }

  // Add the Peer
  this._peers[peer.uuid] = peer;

  // Add the Peer's UA
  var sipua = new SipUA(this, peer);
  this._sipuas[peer.uuid] = sipua;

  return sipua;
};

/**
 * Check to see if a {@link SipUA} is associated with the given {@link Peer}.
 * @param {Peer} peer - the {@link Peer} to check
 * @returns {boolean}
 */
SipUAFactory.prototype.hasPeer = function hasPeer(peer) {
  return peer.uuid in this._peers;
};

/**
 * Remove and close the {@link SipUA} associated with the given {@link Peer}.
 * @instance
 * @param {Peer} peer - the {@link Peer} to remove and close the associated
 *   {@link SipUA} for
 * @returns {?SipUA}
 */
SipUAFactory.prototype.removePeer = function removePeer(peer) {
  if (peer.uuid in this._peers) {
    delete this._peers[peer.uuid];
    var sipua = this._sipuas[peer.uuid];
    delete this._sipuas[peer.uuid];
    sipua.close();
    return peer;
  }
  return null;
};

SipUAFactory.prototype.addCall = function addCall(sipua, call) {
  if (sipua._calls[call.uuid]) {
    throw new Error('Call ' + call.uuid + ' already present on SipUA');
  }
  sipua._calls[call.uuid] = call;
  return sipua;
};

SipUAFactory.prototype.removeCall = function removeCall(sipua, call) {
  var removed = sipua._calls[call.uuid];
  delete sipua._calls[call.uuid];
  return removed;
};

module.exports = SipUAFactory;
