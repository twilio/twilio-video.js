'use strict';

var constants = require('./constants');
var headers = constants.headers;

/**
 * Decode a base64-encoded string.
 * @param {string} encoded - the base64-encoded string
 * @returns {string}
 */
var decodeBase64 = typeof atob === 'function' ? atob : function(encoded) {
  return new Buffer(encoded, 'base64').toString('ascii');
};

/**
 * Base64-encode a string.
 * @param {string} plaintext - the string to base64-encode
 * @returns {string}
 */
var encodeBase64 = typeof btoa === 'function' ? btoa : function(message) {
  return new Buffer(message).toString('base64');
};

var base64 = {
  decode: decodeBase64,
  encode: encodeBase64
};

/**
 * Decode a base64url-encoded string.
 * @param {string} encoded - the base64url-encoded string
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

var base64URL = {
  decode: memoize(decodeBase64URL)
};

/**
 * Deep-clone an object. Note that this does not work on object containing
 * functions.
 * @param {object} obj - the object to deep-clone
 * @returns {object}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Decode an x-www-form-urlencoded string into an array of key-value pairs.
 * @param {string} encoded - the x-www-form-urlencoded string
 * @returns {Array}
 */
// FIXME: Currently returns an object.
function fromURLFormEncoded(params) {
  if (params === '') {
    return {};
  }
  var result = {};
  var pairs = params.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    var key = decodeURIComponent(pair[0]);
    var val = pair[1] ? decodeURIComponent(pair[1]) : null;
    result[key] = val;
  }
  return result;
}

/**
 * Construct an array of INVITE headers.
 * @param {object} info - the device info
 * @param {CapabilityToken} token - the {@link CapabilityToken}
 * @param {object} params - the client parameters
 * @returns {Array}
 */
function makeInviteHeaders(info, token, params) {
  var inviteHeaders = [
    headers.X_TWILIO_TOKEN         + ': ' + token.capabilityTokenString,
    headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify(info),
    headers.X_TWILIO_CLIENTVERSION + ': ' + constants.CLIENT_VERSION
  ];
  if (params) {
    inviteHeaders.push(headers.X_TWILIO_PARAMS + ': ' + toURLFormEncoded(params));
  }
  return inviteHeaders;
}

/**
 * Construct an array of REGISTER headers.
 * @param {object} info - the device info
 * @param {CapabilityToken} token - the {@link CapabilityToken}
 * @returns {Array}
 */
function makeRegisterHeaders(info, token) {
  var registerHeaders = [
    headers.X_TWILIO_TOKEN         + ': ' + token.capabilityTokenString,
    headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify(info),
    headers.X_TWILIO_CLIENTVERSION + ': ' + constants.CLIENT_VERSION
  ];
  return registerHeaders;
}

/**
 * Construct the SIP target URI for an app SID.
 * @param {string} appSID - the app SID
 * @returns {string}
 */
function makeTarget(appSID) {
  return 'sip:' + appSID + '@' + constants.CHUNDER_HOST;
}

/**
 * Construct the SIP URI for a client of a particular account.
 * @param {string} accountSID - the account SID
 * @param {string} clientName - the client name
 * @returns {string}
 */
function makeURI(accountSID, clientName) {
  return (clientName || constants.DEFAULT_PEER_NAME) +
    '@' + accountSID + '.chunder.twilio.com';
}

/**
 * Memoize a function. Be careful with this.
 * @param {function} fn - the function to memoize
 * @returns {function}
 */
function memoize(fn) {
  var memo = {};
  return function() {
    var args = Array.prototype.slice.call(arguments, 0);
    return memo[args] ? memo[args]
                      : memo[args] = fn.apply(null, args);
  };
}

/**
 * Encode an array of key-value pairs as an x-www-form-urlencoded string.
 * @param {Array} pairs - the array of key-value pairs
 * @returns {string}
 */
// FIXME: Currently this uses objects.
function toURLFormEncoded(dict) {
  var str = '';
  for (var key in dict) {
    str += encodeURIComponent(key) + '=' + encodeURIComponent(dict[key]);
  }
  return str;
}

/**
 * Require a given module without Browserify attempting to package it for us.
 * @param {string} module - the module to require
 * @returns {Object}
 */
function requireNoBrowserify(module) {
  return eval("require('" + module + "')");
}

function getKeys(obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }
  return keys;
}

function getValues(obj) {
  var values = [];
  for (var key in obj) {
    values.push(obj[key]);
  }
  return values;
}

function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

module.exports.base64 = base64;
module.exports.base64URL = base64URL;
module.exports.deepClone = deepClone;
module.exports.fromURLFormEncoded = fromURLFormEncoded;
module.exports.makeInviteHeaders = makeInviteHeaders;
module.exports.makeRegisterHeaders = makeRegisterHeaders;
module.exports.makeTarget = makeTarget;
module.exports.makeURI = makeURI;
// module.exports.parseConnectTarget = parseConnectTarget;
module.exports.toURLFormEncoded = toURLFormEncoded;
module.exports.requireNoBrowserify = requireNoBrowserify;
module.exports.getKeys = getKeys;
module.exports.getValues = getValues;
module.exports.makeUUID = makeUUID;
