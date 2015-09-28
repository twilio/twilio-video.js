'use strict';

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var util = require('./util');

/**
 * Parse a JWT to an {@link AccessToken}.
 * @class
 * @classdesc An {@link AccessToken} wraps a JSON Web Token
 *   (JWT) granting a {@link Client} permissions to interact with the
 *   {@link Conversation} APIs.
 * @param {string} jwt - The {@link AccessToken} string to parse
 * @property {string} accountSid - The account SID
 * @property {?string} address - The address this {@link AccessToken} allows a {@link Client}
 *   to receive {@link Invite}s to {@link Conversation}s at, if any
 * @property {boolean} canInvite - Whether or not this {@link AccessToken} allows a
 *   {@link Client} to create {@link Conversation}s and invite other
 *   {@link Participant}s
 * @property {boolean} canListen - Whether or not this {@link AccessToken} allows a
 *   {@link Client} to listen for {@link Invite}s to {@link Conversation}s
 * @property {Date} expires - The time at which this {@link AccessToken} expires
 * @property {Array<AccessToken#Grant>} grants - This {@link AccessToken}'s {@link AccessToken#Grant}s
 * @property {boolean} isExpired - Whether or not this {@link AccessToken} has expired
 * @property {string} jwt - The unparsed {@link AccessToken} string
 * @property {string} signingKeySid - The SID of the signing key used to sign
 *   this {@link AccessToken}
 * @fires AccessToken#expired
 */
function AccessToken(jwt) {
  if (jwt instanceof AccessToken) {
    return jwt;
  } else if (!(this instanceof AccessToken)) {
    return new AccessToken(jwt);
  }

  EventEmitter.call(this);

  var payload = parsePayload(jwt);

  var address = null;
  var canInvite = false;
  var canListen = false;
  var expires = new Date(payload.exp * 1000);

  var grants = payload.grants || [];
  grants.forEach(function(grant) {
    var res = grant.res;
    var match = res.match(/^sip:(.*)@/);
    if (match) {
      address = match[1];
      canInvite = grant.act.indexOf('invite') !== -1;
      canListen = grant.act.indexOf('listen') !== -1;
    }
  });

  var self = this;
  setTimeout(function() {
    self.emit('expired', self);
  }, expires - Date.now());

  /* istanbul ignore next */
  Object.defineProperties(this, {
    accountSid: {
      enumerable: true,
      value: payload.sub
    },
    address: {
      enumerable: true,
      value: address
    },
    canInvite: {
      enumerable: true,
      value: canInvite
    },
    canListen: {
      enumerable: true,
      value: canListen
    },
    expires: {
      enumerable: true,
      value: expires
    },
    grants: {
      enumerable: true,
      value: grants
    },
    isExpired: {
      enumerable: true,
      get: function() {
        return new Date() >= expires;
      }
    },
    jwt: {
      enumerable: true,
      value: jwt
    },
    signingKeySid: {
      enumerable: true,
      value: payload.iss
    }
  });

  return Object.freeze(this);
}

inherits(AccessToken, EventEmitter);

function parsePayload(jwt) {
  var segments = jwt.split('.');
  if (segments.length !== 3) {
    throw new Error('Token is invalid or malformed');
  }
  var encodedPayloadString = segments[1];
  var payloadString = util.base64URL.decode(encodedPayloadString);
  var payload = JSON.parse(payloadString);
  return payload;
}

/**
 * This {@link AccessToken} has expired.
 * @param {AccessToken} token - This {@link AccessToken}
 * @event AccessToken#expired
 * @example
 * var client = new Twilio.Conversations.Client('$TOKEN');
 *
 * client.listen().then(function() {
 *  var activeToken = client.token;
 *  activeToken.on('expired', function(token) {
 *    console.error('The active token has expired:', token.address);
 *  });
 * });
 */

/**
 * A grant describes a resource and the actions that a client can perform on
 * said resource using an {@link AccessToken}.
 * @property {string} res - the resource granted
 * @property {Array<string>} act - the list of actions granted on the resource
 * @typedef {object} Twilio.AccessToken#Grant
 */

module.exports = AccessToken;
