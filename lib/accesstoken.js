'use strict';

var util = require('./util');

/**
 * Parses JWT to an {@link AccessToken}.
 * @class
 * @classdesc A {@link AccessToken} ({@link AccessToken}) wraps a JSON Web Token
 *   (JWT) granting an {@link Endpoint} permissions to interact with the
 *   {@link Conversation} APIs.
 * @param {string} jwt - the {@link AccessToken} string to parse
 * @property {string} accountSid - the account SID
 * @property {?string} address - the address this {@link AccessToken} allows an {@link Endpoint}
 *   to receive {@link Invite}s to {@link Conversation}s at, if any
 * @property {Array<AccessToken#Grant>} grants - this {@link AccessToken}'s {@link AccessToken#Grant}s
 * @property {boolean} canInvite - whether or not this {@link AccessToken} allows an
 *   {@link Endpoint} to create {@link Conversation}s and invite other
 *   {@link Participant}s
 * @property {boolean} canListen - whether or not this {@link AccessToken} allows an
 *   {@link Endpoint} to listen for {@link Invite}s to {@link Conversation}s
 * @property {Date} expires - the time at which this {@link AccessToken} expires
 * @property {boolean} isExpired - whether or not this {@link AccessToken} has expired
 * @property {string} jwt - the unparsed {@link AccessToken} string
 * @property {string} signingKeySid - the SID of the signing key used to sign
 *   this {@link AccessToken}
 */
function AccessToken(jwt) {
  if (jwt instanceof AccessToken) {
    return jwt;
  } else if (!(this instanceof AccessToken)) {
    return new AccessToken(jwt);
  }

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
 * A grant describes a resource and the actions that a client can perform on
 * said resource using an {@link AccessToken}.
 * @property {string} res - the resource granted
 * @property {Array<string>} act - the list of actions granted on the resource
 * @typedef {object} AccessToken#Grant
 */

module.exports = AccessToken;
