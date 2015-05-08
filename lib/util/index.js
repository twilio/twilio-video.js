'use strict';

var inherits = require('util').inherits;
var CancelablePromise = require('./cancelablepromise');
var constants = require('./constants');
var headers = constants.headers;
var Map = require('es6-map');
var Q = require('q');

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

/**
 * Construct an array of INVITE headers.
 * @param {object} info - the device info
 * @param {ScopedAuthenticationToken} token - the {@link ScopedAuthenticationToken}
 * @param {?object} params - the client parameters
 * @param {?string} session
 * @returns {Array}
 */
function makeInviteHeaders(info, token, params, session) {
  var cmg = [
    headers.X_TWILIO_TOKEN         + ': ' + token.jwt,
    headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify(info),
    headers.X_TWILIO_CLIENTVERSION + ': ' + constants.CLIENT_VERSION
  ];
  if (params) {
    cmg.push(headers.X_TWILIO_PARAMS + ': ' + toURLFormEncoded(params));
  }
  if (session) {
    vss.push(headers.X_TWILIO_SESSION + ': ' + session);
  }
  return cmg;
}

function getSDKVersion() {
  // NOTE(mroberts): Set by `Makefile'.
  return process.env.SDKVER || 'unknown';
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
 * @param {ScopedAuthenticationToken} token - the {@link ScopedAuthenticationToken}
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

function any(promises) {
  promises = promises.map(CancelablePromise);
  
  var deferred = Q.defer();
  deferred.promise = CancelablePromise(deferred.promise);

  var first = true;
  function resolve(value) {
    if (first) {
      first = false;
      deferred.resolve(value);
    }
  }
  var reasons = [];
  function reject(reason) {
    reasons.push(reason);
    if (reasons.length === promises.length) {
      // TODO(mroberts): Reject with all reasons?
      deferred.reject(reason);
    }
  }
  promises.forEach(function(promise) {
    promise.then(resolve, reject);
  });

  var cancelDeferred = deferred.promise.cancel.bind(deferred.promise);
  function cancelPromises() {
    if(!first) { return; }
    first = false;

    promises.forEach(function(promise) {
      promise.cancel();
    });

    cancelDeferred();
  }

  Object.defineProperties(deferred.promise, {
    cancel: { value: cancelPromises }
  });

  return deferred.promise;
}

function withDefaults(options, defaults) {
  options = options || {};
  for (var option in defaults) {
    if (!(option in options)) {
      options[option] = defaults[option];
    }
  }
  return options;
}

function extend(dest, src) {
  dest = dest || { };
  for (var key in src) {
    dest[key] = src[key];
  }

  return dest;
}

function tails(xs) {
  if (xs.length === 0) {
    return [[]];
  } else {
    return [xs].concat(tails(xs.slice(1)));
  }
}

var sessionRegistry = new Map();

function _return(value) {
  return function() {
    return value;
  };
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
      'urls': url,
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
      eventEmitter.off(failureEvent, onFailure);
    }
    deferred.resolve.apply(null, args);
  }
  function onFailure() {
    var args = [].slice.call(arguments);
    eventEmitter.off(successEvent, onSuccess);
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
  var match = contactHeader.match(/^<sip:(.*)@(.*)$/);
  return match ? match[1] : null;
}

function emitNext() {
  var args = [].slice.call(arguments);
  var eventEmitter = args[0];
  var args = args.slice(1);
  setTimeout(function() {
    eventEmitter.emit.call(eventEmitter, args);
  });
  return eventEmitter;
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
  var specs = { name: M[1], version: M[2] + '.' + M[3] };
  
  if(/trident/i.test(specs.name)) {
    var parts = /\brv[ :]+(\d+)\.(\d+)/g.exec(ua) || [];
    return { name: 'IE', version: parts[1] ? (parts[1] + '.' + parts[2]) : '' };
  }
  
  if(specs.name === 'Chrome') {
    var parts = ua.match(/\b(OPR|Edge)\/(\d+)\.(\d+)/);
    if(parts != null) { return { name: 'Opera', version: parts[2] + '.' + parts[3] }; }
  }

  if(specs.name === 'MSIE') {
    specs.name = 'IE';
  }
  
  return specs;
}

module.exports.base64 = base64;
module.exports.base64URL = base64URL;
module.exports.deepClone = deepClone;
module.exports.fromURLFormEncoded = fromURLFormEncoded;
module.exports.makeInviteHeaders = makeInviteHeaders;
module.exports.makeRegisterHeaders = makeRegisterHeaders;
module.exports.makeTarget = makeTarget;
module.exports.makeURI = makeURI;
module.exports.toURLFormEncoded = toURLFormEncoded;
module.exports.requireNoBrowserify = requireNoBrowserify;
module.exports.getKeys = getKeys;
module.exports.getValues = getValues;
module.exports.makeUUID = makeUUID;
module.exports.race = race;
module.exports.any = any;
module.exports.withDefaults = withDefaults;
module.exports.extend = extend;
module.exports.tails = tails;
module.exports.sessionRegistry = sessionRegistry;
module.exports.return = _return;
module.exports.getStunServers = getStunServers;
module.exports.getTurnServers = getTurnServers;
module.exports.promiseFromEvents = promiseFromEvents;
module.exports.parseConversationSIDFromContactHeader = parseConversationSIDFromContactHeader;
module.exports.emitNext = emitNext;
module.exports.getOrNull = getOrNull;
module.exports.isValidIceServerArray = isValidIceServerArray;
module.exports.parseUserAgent = parseUserAgent;
