'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var constants = require('../../constants');
var session = require('../../session');
var IncomingSession = session.IncomingSession;
var OutgoingSession = session.OutgoingSession;
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
 *   used by {@link Endpoint}s to make sessions.
 * @property {Array<Endpoint>} endpoints - the {@link Endpoint}s which have active {@link
 *   SipUA}s created by this {@link SipUAFactory}
 * @property {Array<SipUA>} uas - the active {@link SipUA}s created by this
 *   {@link SipUAFactory}
 */
function SipUAFactory(options) {
  if (!(this instanceof SipUAFactory)) {
    return new SipUAFactory(options);
  }

  EventEmitter.call(this);

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
    _endpoints: {
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
    'endpoints': {
      get: function() {
        return util.getKeys(self._endpoints);
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
 * Create a new {@link SipUA} for the given {@link Endpoint}.
 * @instance
 * @param {Endpoint} endpoint - the {@link Endpoint} to create a {@link SipUA} for
 * @returns {SipUA}
 */
SipUAFactory.prototype.addEndpoint = function addEndpoint(endpoint) {
  if (this._endpoints[endpoint.uuid]) {
    throw new Error('Endpoint ' + endpoint.uuid + ' already present on SipUAFactory');
  }

  // Add the Endpoint
  this._endpoints[endpoint.uuid] = endpoint;

  // Add the Endpoint's UA
  var sipua = new SipUA(this, endpoint);
  this._sipuas[endpoint.uuid] = sipua;

  return sipua;
};

/**
 * Check to see if a {@link SipUA} is associated with the given {@link Endpoint}.
 * @param {Endpoint} endpoint - the {@link Endpoint} to check
 * @returns {boolean}
 */
SipUAFactory.prototype.hasEndpoint = function hasEndpoint(endpoint) {
  return endpoint.uuid in this._endpoints;
};

/**
 * Remove and close the {@link SipUA} associated with the given {@link Endpoint}.
 * @instance
 * @param {Endpoint} endpoint - the {@link Endpoint} to remove and close the associated
 *   {@link SipUA} for
 * @returns {?SipUA}
 */
SipUAFactory.prototype.removeEndpoint = function removeEndpoint(endpoint) {
  if (endpoint.uuid in this._endpoints) {
    delete this._endpoints[endpoint.uuid];
    var sipua = this._sipuas[endpoint.uuid];
    delete this._sipuas[endpoint.uuid];
    sipua.close();
    return endpoint;
  }
  return null;
};

SipUAFactory.prototype.addSession = function addSession(sipua, session) {
  if (sipua._sessions[session.uuid]) {
    throw new Error('Session ' + session.uuid + ' already present on SipUA');
  }
  sipua._sessions[session.uuid] = session;
  return sipua;
};

SipUAFactory.prototype.removeSession = function removeSession(sipua, session) {
  var removed = sipua._sessions[session.uuid];
  delete sipua._sessions[session.uuid];
  return removed;
};

module.exports = SipUAFactory;
