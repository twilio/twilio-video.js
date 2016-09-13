'use strict';

// NOTE(mroberts): The functions here are a stop-gap solution; we really should
// not be parsing Access Tokens in the Client.

/**
 * Parse the payload of a JSON Web Token (JWT).
 * @private
 * @param {string} jwt
 * @returns {object}
 */
function parsePayload(jwt) {
  var segments = jwt.split('.');
  if (segments.length !== 3) {
    throw new Error('Token is invalid or malformed');
  }
  var encodedPayloadString = segments[1];
  var payloadString = decodeBase64URL(encodedPayloadString);
  var payload = JSON.parse(payloadString);
  return payload;
}

/**
 * Decode a base64url-encoded string.
 * @private
 * @param {string} encoded
 * @returns {string}
 */
function decodeBase64URL(encoded) {
  var remainder = encoded.length % 4;
  if (remainder > 0) {
    var padlen = 4 - remainder;
    encoded += new Array(padlen + 1).join('=');
  }
  encoded = encoded.replace(/-/g, '+')
                   .replace(/_/g, '/');
  return decodeBase64(encoded);
}

/**
 * Decode a base64-encoded string.
 * @private
 * @param {string} encoded
 * @returns {string}
 */
function decodeBase64(encoded) {
  return new Buffer(encoded, 'base64').toString();
}

/**
 * Get the Account SID out of an Access Token.
 * @param {string} token
 * @returns {string}
 * @throws
 */
function getAccountSid(token) {
  return parsePayload(token).sub;
}

/**
 * Get the identity out of an Access Token.
 * @param {string} token
 * @returns {string}
 * @throws
 */
function getIdentity(token) {
  return parsePayload(token).grants.identity;
}

exports.getAccountSid = getAccountSid;
exports.getIdentity = getIdentity;
