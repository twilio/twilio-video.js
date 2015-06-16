'use strict';

var inherits = require('util').inherits;
var CancelablePromise = require('./cancelablepromise');
var constants = require('./constants');
var E = constants.twilioErrors;
var headers = constants.headers;
var Q = require('q');
var request = require('./request');

/**
 * Decode a base64-encoded string.
 * @param {string} encoded - the base64-encoded string
 * @returns {string}
 */
function decodeBase64(encoded) {
  return typeof atob === 'function' ?
    atob(encoded) :
    new Buffer(encoded, 'base64').toString('ascii');
};

/**
 * Base64-encode a string.
 * @param {string} plaintext - the string to base64-encode
 * @returns {string}
 */
function encodeBase64(message) {
  return typeof btoa === 'function' ?
    btoa(message) :
    new Buffer(message).toString('base64');
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
 * Construct an array of REGISTER headers.
 * @param {AccessToken} token - the {@link AccessToken}
 * @returns {Array}
 */
function makeRegisterHeaders(token) {
  var systemInfo = makeSystemInfo();
  var cmg = [
    headers.X_TWILIO_TOKEN         + ': ' + token.jwt,
    headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify(systemInfo),
    headers.X_TWILIO_CLIENTVERSION + ': ' + constants.CLIENT_VERSION
  ];
  return cmg;
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
  return encodeURIComponent((clientName || constants.DEFAULT_PEER_NAME)) +
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
  var deferred = Q.defer();
  function onSuccess() {
    var args = [].slice.call(arguments);
    if (failureEvent) {
      eventEmitter.removeListener(failureEvent, onFailure);
    }
    deferred.resolve.apply(null, args);
  }
  function onFailure() {
    var args = [].slice.call(arguments);
    eventEmitter.removeListener(successEvent, onSuccess);
    deferred.reject.apply(null, args);
  }
  eventEmitter.once(successEvent, onSuccess);
  if (failureEvent) {
    eventEmitter.once(failureEvent, onFailure);
  }
  operation();
  return deferred.promise;
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
  }
}

/**
 * Fetches ICE servers from Twilio.
 * @instance
 * @returns {Promise<Array<object>>}
 */
function fetchIceServers(token, options) {
  var apiHost = options.apiHost || 'api.twilio.com';
  var log = options.log;

  /* istanbul ignore next: external dependency */
  var requestFactory = options.requestFactory || request;

  var requestParams = {
    url: 'https://' + apiHost + '/2010-04-01/Accounts/' + token.accountSid + '/Tokens.json',
    headers: { 'Authorization': 'Basic ' + encodeBase64('Token:' + token.jwt) }
  };

  return requestFactory.post(requestParams).then(function(res) {
    return JSON.parse(res)['ice_servers'];
  }, function(reason) {
    if (log) {
      log.warn(E.ICE_FETCH_FAILED, 'Failed to fetch ephemeral TURN server credential', reason);
    }
    return constants.DEFAULT_ICE_SERVERS;
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

module.exports.base64 = base64;
module.exports.base64URL = base64URL;
module.exports.deepClone = deepClone;
module.exports.fromURLFormEncoded = fromURLFormEncoded;
module.exports.makeRegisterHeaders = makeRegisterHeaders;
module.exports.makeTarget = makeTarget;
module.exports.makeURI = makeURI;
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
module.exports.memoize = memoize;
