'use strict';

var CapabilityToken = require('./capabilitytoken');

/**
 * Parse a {@link Token} string to a {@link Token}
 * @class
 * @classdesc A {@link Token} allows you an {@link Endpoint} to register to
 *   particular address and to receive {@link Session} invitations from other
 *   {@link Participant}s.
 *   <br><br>
 *   Currently this is an opaque string representing a JSON blob containing
 *   both a Client capability token and a Network Traversal Service token. In
 *   the future this will change.
 * @param {string} token - the {@link Token} string to parse
 * @property {string} address - the address this token registers an
 *   {@link Endpoint} to
 */
function Token(token) {
  if (!(this instanceof Token)) {
    return new Token(token);
  }

  var combined = JSON.parse(token);
  var capabilityTokenString = combined['capabilityToken'];
  var capabilityToken = new CapabilityToken(capabilityTokenString);
  var accountSid = capabilityToken.accountSid.replace(/^ac/, 'AC');
  var address = capabilityToken.incomingClientName;
  var stunTurnToken = combined['stunTurnToken'];

  Object.defineProperties(this, {
    '_capabilityToken': {
      value: capabilityToken,
    },
    '_stunTurnToken': {
      value: stunTurnToken
    },
    'accountSid': {
      value: accountSid
    },
    'address': {
      value: address
    }
  });
  return Object.freeze(this);
}

module.exports = Token;
