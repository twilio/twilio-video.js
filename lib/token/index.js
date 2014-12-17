'use strict';

var CapabilityToken = require('./capabilitytoken');

/**
 * Parse a token string to a {@link Token}
 * @class
 * @classdesc A Signal {@link Token} allows you to connect your
 * {@link Endpoint} to Twilio.
 * <br><br>
 * Currently this is an opaque string representing a JSON blob containing both
 * a Client capability token and a Network Traversal Service token. In the
 * future this will change.
 * @param {string} token - the token string to parse
 */
function Token(token) {
  if (!(this instanceof Token)) {
    return new Token(token);
  }
  var combined = JSON.parse(token);
  var capabilityTokenString = combined['capabilityToken'];
  var capabilityToken = new CapabilityToken(capabilityTokenString);
  var stunTurnToken = combined['stunTurnToken'];
  Object.defineProperties(this, {
    _capabilityToken: {
      value: capabilityToken,
    },
    _stunTurnToken: {
      value: stunTurnToken
    }
  });
  return Object.freeze(this);
}

module.exports = Token;
