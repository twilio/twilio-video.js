'use strict';

var inherits = require('util').inherits;
var C = require('./constants');
var CancelablePromise = require('./cancelablepromise');
var E = C.twilioErrors;
var headers = C.headers;
var Q = require('q');
var request = require('./request');
var map = require('./map');

/**
 * Base64-encode a string.
 * @param {string} plaintext - the string to base64-encode
 * @returns {string}
 */
function encodeBase64(message) {
  return typeof btoa === 'function' ?
    btoa(message) :
    new Buffer(message).toString('base64');
}

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
  if (!params) {
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

function getSDKVersion() {
  // NOTE(mroberts): Set by `Makefile'.
  return process.env.SDK_VERSION || 'unknown';
}

function makeSystemInfo() {
  var version = getSDKVersion();
  var nav = typeof navigator === 'undefined' ? {} : navigator;
  return {
    'p': 'browser',
    'v': version,
    'browser': {
      'userAgent': nav.userAgent || 'unknown',
      'platform': nav.platform || 'unknown'
    },
    'plugin': 'rtc'
  };
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
  return typeof atob === 'function'
    ? atob(encoded)
    : new Buffer(encoded, 'base64').toString();
}

// TODO(mrobers): Remove this function as soon as we move to FPA.
function selectTokenHeader(token) {
  var parts = token.split('.');
  var header;
  try {
    header = JSON.parse(decodeBase64URL(parts[0]));
  } catch (error) {
    return headers.X_TWILIO_IDENTITYTOKEN;
  }
  return typeof header.cty === 'string' && header.cty.match(/^twilio-fpa/)
    ? headers.X_TWILIO_IDENTITYTOKEN
    : headers.X_TWILIO_TOKEN;
}

/**
 * Construct an array of REGISTER headers.
 * @param {string} token - an Access Token
 * @returns {Array}
 */
function makeRegisterHeaders(token) {
  var systemInfo = makeSystemInfo();
  var cmg = [
    selectTokenHeader(token)       + ': ' + token,
    headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify(systemInfo),
    headers.X_TWILIO_CLIENTVERSION + ': ' + C.CLIENT_VERSION
  ];
  return cmg;
}

/**
 * Construct the SIP target URI for an app SID.
 * @param {string} appSID - the app SID
 * @returns {string}
 */
function makeTarget(appSID) {
  return 'sip:' + appSID + '@' + C.CHUNDER_HOST;
}

/**
 * Construct the SIP URI for a client of a particular account.
 * @param {string} accountSid - the Account SID
 * @param {string} clientName - the client name
 * @returns {string}
 */
function makeURI(accountSid, clientName) {
  return encodeURIComponent((clientName || C.DEFAULT_PEER_NAME)) +
    '@' + C.REGISTRAR_SERVER(accountSid);
}

/**
 * Get the decoded user portion of a SIP URI.
 * @param {string} uri - the SIP URI
 * @returns {?string}
 */
function getUser(uri) {
  var SIPJS = require('sip.js');
  var result = SIPJS.Grammar.parse(uri, 'Contact');
  if (result !== -1 && result[0]) {
    return result[0].parsed.uri.user;
  }
  return null;
}

/**
 * Encode an array of key-value pairs as an x-www-form-urlencoded string.
 * @param {Array} pairs - the array of key-value pairs
 * @returns {string}
 */
// FIXME: Currently this uses objects.
function toURLFormEncoded(dict) {
  var pairs = [];
  for (var key in dict) {
    pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(dict[key]));
  }
  return pairs.join('&');
}

function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function race(promises) {
  var deferred = Q.defer();
  var first = true;
  function resolve(value) {
    if (first) {
      first = false;
      deferred.resolve(value);
    }
  }
  function reject(reason) {
    if (first) {
      first = false;
      deferred.reject(reason);
    }
  }
  promises.forEach(function(promise) {
    promise.done(resolve, reject);
  });
  return deferred.promise;
}

function withDefaults(destination, sources) {
  destination = destination || {};
  sources = Array.prototype.slice.call(arguments, 1);
  sources.forEach(function(source) {
    _withDefaults(destination, source);
  });

  return destination;
}
function _withDefaults(destination, source) {
  for (var key in source) {
    if (!(key in destination)) {
      destination[key] = source[key];
    }
  }

  return destination;
}

function extend(destination, sources) {
  destination = destination || {};
  sources = Array.prototype.slice.call(arguments, 1);
  sources.forEach(function(source) {
    _extend(destination, source);
  });

  return destination;
}
function _extend(destination, source) {
  for (var key in source) {
    destination[key] = source[key];
  }

  return destination;
}

function separateIceServers(iceServers) {
  var stunServers = [];
  var turnServers = [];
  if (iceServers) {
    iceServers.forEach(function(iceServer) {
      if (!iceServer.url) {
        return;
      }
      var schema = iceServer['url'].split(':')[0];
      if (schema === 'stun' || schema === 'stuns') {
        stunServers.push(iceServer);
      } else if (schema === 'turn' || schema === 'turns') {
        turnServers.push(iceServer);
      }
    });
  }
  stunServers = stunServers.map(function(stunServer) {
    return stunServer['url'].split('?')[0];
  });
  turnServers = turnServers.map(function(turnServer) {
    var url = turnServer['url'].split('?')[0];
    var username = turnServer['username'];
    var password = turnServer['credential'];
    return {
      'urls': [url],
      'username': username,
      'password': password
    };
  });
  return { 'stunServers': stunServers, 'turnServers': turnServers };
}

function getStunServers(iceServers) {
  return separateIceServers(iceServers)['stunServers'];
}

function getTurnServers(iceServers) {
  return separateIceServers(iceServers)['turnServers'];
}

function promiseFromEvents(operation, eventEmitter, successEvent, failureEvent) {
  return new Promise(function(resolve, reject) {
    function onSuccess() {
      var args = [].slice.call(arguments);
      if (failureEvent) {
        eventEmitter.removeListener(failureEvent, onFailure);
      }
      resolve.apply(null, args);
    }
    function onFailure() {
      var args = [].slice.call(arguments);
      eventEmitter.removeListener(successEvent, onSuccess);
      reject.apply(null, args);
    }
    eventEmitter.once(successEvent, onSuccess);
    if (failureEvent) {
      eventEmitter.once(failureEvent, onFailure);
    }
    operation();
  });
}

function parseConversationSIDFromContactHeader(contactHeader) {
  var match = contactHeader.match(/<sip:(.*)@(.*)$/);
  return match ? match[1] : null;
}

/**
 * Traverse down multiple nodes on an object and return null if
 * any link in the path is unavailable.
 * @param {Object} obj - Object to traverse
 * @param {String} path - Path to traverse. Period-separated.
 * @returns {Any|null}
 */
function getOrNull(obj, path) {
  return path.split('.').reduce(function(output, step) {
    if(!output) { return null; }
    return output[step];
  }, obj);
}

/**
 * Validate that the passed argument is a valid ICE servers array
 * @param {Array} iceServers - Potentially, an array of valid ICE servers
 * @returns {Boolean} Whether or not the argument is a valid ICE array
 */
function isValidIceServerArray(iceServers) {
  // Should be an array
  if (typeof iceServers.forEach === 'undefined') { return false; }

  // Each item should contain a URL property
  return iceServers.reduce(function(isValid, item) {
    return isValid && (typeof item.url !== 'undefined');
  }, true);
}

/**
 * Parse the passed userAgent string down into a simple object.
 * Example browser object: { name: 'Chrome', version: '42.0' }
 * @returns {Object} Object containing a name and version.
 */
function parseUserAgent(ua) {
  var M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)\.(\d+)/i) || [];
  var specs = {
    name: M[1],
    version: typeof M[2] !== 'undefined' && typeof M[3] !== 'undefined' && M[2] + '.' + M[3]
  };

  var parts;

  if(/trident/i.test(specs.name)) {
    parts = /\brv[ :]+(\d+)\.(\d+)/g.exec(ua) || [];
    return { name: 'IE', version: parts[1] ? (parts[1] + '.' + parts[2]) : 'Unknown' };
  }

  if(specs.name === 'Chrome') {
    parts = ua.match(/\b(OPR|Edge)\/(\d+)\.(\d+)/);
    if(parts !== null) { return { name: 'Opera', version: parts[2] + '.' + parts[3] }; }
  }

  if(specs.name === 'MSIE') {
    specs.name = 'IE';
  }

  return {
    name: specs.name || 'Unknown',
    version: specs.version || 'Unknown'
  };
}

/**
 * Fetches ICE servers from Twilio.
 * @param {string} accountSid
 * @param {string} token
 * @param {object} [options]
 * @returns {Promise<Array<object>>}
 */
function fetchIceServers(accountSid, token, options) {
  var apiHost = options.apiHost || 'api.twilio.com';
  var log = options.log;

  /* istanbul ignore next: external dependency */
  var requestFactory = options.requestFactory || request;

  var requestParams = {
    url: 'https://' + apiHost + '/2010-04-01/Accounts/' + accountSid + '/Tokens.json',
    headers: { 'Authorization': 'Basic ' + encodeBase64('Token:' + token) }
  };

  return requestFactory.post(requestParams).then(function(res) {
    return JSON.parse(res)['ice_servers'];
  }, function(reason) {
    if (log) {
      log.warn(E.ICE_FETCH_FAILED, 'Failed to fetch ephemeral TURN server credential', reason);
    }
    return C.DEFAULT_ICE_SERVERS;
  });
}

/**
 * Overwrite an existing Array with a new one. This is useful when the existing
 * Array is an immutable property of another object.
 * @param {Array} oldArray - the existing Array to overwrite
 * @param {Array} newArray - the new Array to overwrite with
 */
function overwriteArray(oldArray, newArray) {
  oldArray.splice(0, oldArray.length);
  newArray.forEach(function(item) {
    oldArray.push(item);
  });
}

function validateAddresses(accountSid, addresses) {
  var invalidAddresses = (addresses.forEach ? addresses : [addresses])
    .map(makeURI.bind(accountSid))
    .filter((address) => address.length > C.MAX_ADDRESS_LENGTH);

  if (invalidAddresses.length) {
    throw new Error('Addresses must not exceed ' + C.MAX_ADDRESS_LENGTH + ' characters: ' + invalidAddresses);
  }
}

module.exports.deepClone = deepClone;
module.exports.encodeBase64 = encodeBase64;
module.exports.fromURLFormEncoded = fromURLFormEncoded;
module.exports.makeRegisterHeaders = makeRegisterHeaders;
module.exports.makeTarget = makeTarget;
module.exports.makeURI = makeURI;
module.exports.getUser = getUser;
module.exports.toURLFormEncoded = toURLFormEncoded;
module.exports.makeUUID = makeUUID;
module.exports.race = race;
module.exports.withDefaults = withDefaults;
module.exports.extend = extend;
module.exports.separateIceServers = separateIceServers;
module.exports.getStunServers = getStunServers;
module.exports.getTurnServers = getTurnServers;
module.exports.promiseFromEvents = promiseFromEvents;
module.exports.parseConversationSIDFromContactHeader = parseConversationSIDFromContactHeader;
module.exports.getOrNull = getOrNull;
module.exports.isValidIceServerArray = isValidIceServerArray;
module.exports.parseUserAgent = parseUserAgent;
module.exports.fetchIceServers = fetchIceServers;
module.exports.overwriteArray = overwriteArray;
module.exports.map = map;
module.exports.validateAddresses = validateAddresses;
module.exports.selectTokenHeader = selectTokenHeader;
