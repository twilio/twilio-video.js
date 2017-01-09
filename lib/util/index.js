/* globals mozRTCPeerConnection */
'use strict';

var constants = require('./constants');
var map = require('./map');
var token = require('./token');

/**
 * Construct the SIP URI for a client of a particular account.
 * @param {string} accountSid - the Account SID
 * @param {string} clientName - the client name
 * @returns {string}
 */
function makeSIPURI(accountSid, clientName) {
  /* eslint new-cap:0 */
  return encodeURIComponent(clientName) + '@' + constants.REGISTRAR_SERVER(accountSid);
}

// TODO(mroberts): Remove this as soon as the following is fixed:
// https://github.com/onsip/SIP.js/issues/286
/**
 * Construct the SIP URI for a client of a particular account specifically for
 * use with registration (this works around a SIP.js bug).
 * @param {string} accountSid - the Account SID
 * @param {string} clientName - the client name
 * @returns {string}
 */
function makeRegistrationSIPURI(accountSid, clientName) {
  /* eslint new-cap:0 */
  return makeSIPURI(accountSid, encodeURIComponent(clientName));
}

/**
 * Get the decoded user portion of a SIP URI.
 * @param {string} uri - the SIP URI
 * @returns {?string}
 */
function getUser(uri) {
  var SIPJS = require('../sip');
  var result = SIPJS.Grammar.parse(uri, 'Contact');
  if (result !== -1 && result[0]) {
    return result[0].parsed.uri.user;
  }
  return null;
}

function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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

function parseRoomSIDFromContactHeader(contactHeader) {
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
    if (!output) { return null; }
    return output[step];
  }, obj);
}

/**
 * @typedef {object} Deferred
 * @property {Promise} promise
 * @property {function} reject
 * @property {function} resolve
 */

/**
 * Create a {@link Deferred}.
 * @returns {Deferred}
 */
function defer() {
  var deferred = {};
  deferred.promise = new Promise(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

/**
 * Copy a method from a `source` prototype onto a `wrapper` prototype. Invoking
 * the method on the `wrapper` prototype will invoke the corresponding method
 * on an instance accessed by `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @param {string} methodName
 * @returns {undefined}
 */
function delegateMethod(source, wrapper, target, methodName) {
  if (wrapper[methodName]) {
    // Skip any methods already set.
    return;
  } else if (methodName.match(/^on[a-z]+$/)) {
    // Skip EventHandlers (these are handled in the constructor).
    return;
  }

  var type;
  try {
    type = typeof source[methodName];
  } catch (error) {
    // NOTE(mroberts): Attempting to check the type of non-function members
    // on the prototype throws an error for some types.
  }

  if (type !== 'function') {
    // Skip non-function members.
    return;
  }

  /* eslint no-loop-func:0 */
  wrapper[methodName] = function() {
    return this[target][methodName].apply(this[target], arguments);
  };
}

/**
 * Copy methods from a `source` prototype onto a `wrapper` prototype. Invoking
 * the methods on the `wrapper` prototype will invoke the corresponding method
 * on an instance accessed by `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @returns {undefined}
 */
function delegateMethods(source, wrapper, target) {
  for (var methodName in source) {
    delegateMethod(source, wrapper, target, methodName);
  }
}

/**
 * For each property name on the `source` prototype, add getters and/or setters
 * to `wrapper` that proxy to `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @returns {undefined}
 */
function proxyProperties(source, wrapper, target) {
  for (var propertyName in source) {
    proxyProperty(source, wrapper, target, propertyName);
  }
}

/**
 * For the property name on the `source` prototype, add a getter and/or setter
 * to `wrapper` that proxies to `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @param {string} propertyName
 * @returns {undefined}
 */
function proxyProperty(source, wrapper, target, propertyName) {
  if (propertyName in wrapper) {
    // Skip any properties already set.
    return;
  } else if (propertyName.match(/^on[a-z]+$/)) {
    Object.defineProperty(wrapper, propertyName, {
      value: null,
      writable: true
    });

    target.addEventListener(propertyName.slice(2), function() {
      wrapper.dispatchEvent.apply(wrapper, arguments);
    });

    return;
  }

  Object.defineProperty(wrapper, propertyName, {
    enumerable: true,
    get: function() {
      return target[propertyName];
    }
  });
}

/**
 * This is a function for turning a Promise into the kind referenced in the
 * Legacy Interface Extensions section of the WebRTC spec.
 * @param {Promise<*>} promise
 * @param {function<*>} onSuccess
 * @param {function<Error>} onFailure
 * @returns {Promise<undefined>}
 */
function legacyPromise(promise, onSuccess, onFailure) {
  if (onSuccess) {
    return promise.then(function(result) {
      onSuccess(result);
    }, function(error) {
      onFailure(error);
    });
  }
  return promise;
}

/**
 * Build the {@link LogLevels} object.
 * @param {String|LogLevel} logLevel - Log level name or object
 * @returns {LogLevels}
 */
function buildLogLevels(logLevel) {
  if (typeof logLevel === 'string') {
    return {
      default: logLevel,
      media: logLevel,
      signaling: logLevel,
      webrtc: logLevel
    };
  }
  return logLevel;
}

/**
 * Get the {@link Track}'s derived class name
 * @param {AudioTrack|VideoTrack|LocalAudioTrack|LocalVideoTrack} track
 * @param {?boolean} [local=undefined]
 * @returns {string}
 */
function trackClass(track, local) {
  local = local ? 'Local' : '';
  return local + (track.kind || '').replace(/\w{1}/, function(m) {
      return m.toUpperCase();
    }) + 'Track';
}

/**
 * Use unified plan SDP format on Firefox
 * @returns {?string} SDP format
 */
function getSdpFormat() {
  return typeof mozRTCPeerConnection !== 'undefined' ? 'unified' : null;
}

module.exports.constants = constants;
module.exports.makeSIPURI = makeSIPURI;
module.exports.makeRegistrationSIPURI = makeRegistrationSIPURI;
module.exports.getUser = getUser;
module.exports.makeUUID = makeUUID;
module.exports.promiseFromEvents = promiseFromEvents;
module.exports.parseRoomSIDFromContactHeader = parseRoomSIDFromContactHeader;
module.exports.map = map;
module.exports.getOrNull = getOrNull;
module.exports.defer = defer;
module.exports.token = token;
module.exports.delegateMethods = delegateMethods;
module.exports.proxyProperties = proxyProperties;
module.exports.legacyPromise = legacyPromise;
module.exports.buildLogLevels = buildLogLevels;
module.exports.trackClass = trackClass;
module.exports.getSdpFormat = getSdpFormat;
