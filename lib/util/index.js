'use strict';

const constants = require('./constants');

/**
 * Return the given {@link LocalTrack} or a new {@link LocalTrack} for the
 * given MediaStreamTrack.
 * @param {LocalTrack|MediaStreamTrack} track
 * @param {object} options
 * @returns {LocalTrack}
 * @throws {TypeError}
 */
function asLocalTrack(track, options) {
  if (track instanceof options.LocalAudioTrack
    || track instanceof options.LocalVideoTrack
    || track instanceof options.LocalDataTrack) {
    return track;
  }
  if (track instanceof options.MediaStreamTrack) {
    return track.kind === 'audio'
      ? new options.LocalAudioTrack(track, options)
      : new options.LocalVideoTrack(track, options);
  }
  throw constants.typeErrors.INVALID_TYPE('track',
    'LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
}

/**
 * Create a new {@link LocalTrackPublication} for the given {@link LocalTrack}.
 * @param {LocalTrack} track
 * @param {string} sid
 * @param {function(track: LocalTrackPublication): void} unpublish
 * @param {object} options
 */
function asLocalTrackPublication(track, sid, unpublish, options) {
  const LocalTrackPublication = {
    audio: options.LocalAudioTrackPublication,
    video: options.LocalVideoTrackPublication,
    data: options.LocalDataTrackPublication
  }[track.kind];
  return new LocalTrackPublication(sid, track, unpublish, options);
}

/**
 * Capitalize a word.
 * @param {string} word
 * @returns {string} capitalized
 */
function capitalize(word) {
  return word[0].toUpperCase() + word.slice(1);
}

/**
 * Log deprecation warnings for the given events of an EventEmitter.
 * @param {string} name
 * @param {EventEmitter} emitter
 * @param {Map<string, string>} events
 * @param {Log} log
 */
function deprecateEvents(name, emitter, events, log) {
  const warningsShown = new Set();
  emitter.on('newListener', function newListener(event) {
    if (events.has(event) && !warningsShown.has(event)) {
      log.deprecated(`${name}#${event} has been deprecated and scheduled for removal in twilio-video.js@2.0.0.${events.get(event)
        ? ` Use ${name}#${events.get(event)} instead.`
        : ''}`);
      warningsShown.add(event);
    }
    if (warningsShown.size >= events.size) {
      emitter.removeListener('newListener', newListener);
    }
  });
}

/**
 * Finds the items in list1 that are not in list2.
 * @param {Array<*>|Map<*>|Set<*>} list1
 * @param {Array<*>|Map<*>|Set<*>} list2
 * @returns {Set}
 */
function difference(list1, list2) {
  list1 = Array.isArray(list1) ? new Set(list1) : new Set(list1.values());
  list2 = Array.isArray(list2) ? new Set(list2) : new Set(list2.values());

  const difference = new Set();

  list1.forEach(item => {
    if (!list2.has(item)) {
      difference.add(item);
    }
  });

  return difference;
}

/**
 * Filter out the keys in an object with a given value.
 * @param {object} object - Object to be filtered
 * @param {*} [filterValue] - Value to be filtered out; If not specified, then
 *   filters out all keys which have an explicit value of "undefined"
 * @returns {object} - Filtered object
 */
function filterObject(object, filterValue) {
  return Object.keys(object).reduce((filtered, key) => {
    if (object[key] !== filterValue) {
      filtered[key] = object[key];
    }
    return filtered;
  }, {});
}

/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} [mapFn]
 * @returns Array<*>
 */
function flatMap(list, mapFn) {
  const listArray = list instanceof Map || list instanceof Set
    ? Array.from(list.values())
    : list;

  mapFn = mapFn || function mapFn(item) {
    return item;
  };

  return listArray.reduce((flattened, item) => {
    const mapped = mapFn(item);
    return flattened.concat(mapped);
  }, []);
}

/**
 * Get the user agent string, or return "Unknown".
 * @returns {string}
 */
function getUserAgent() {
  return typeof navigator !== 'undefined' && navigator.userAgent
    ? navigator.userAgent
    : 'Unknown';
}

/**
 * Construct the SIP URI for a client.
 * @returns {string}
 */
function makeClientSIPURI() {
  /* eslint new-cap:0 */
  return `${makeUUID()}@${constants.REGISTRAR_SERVER}`;
}

/**
 * Construct the SIP URI for the server.
 * @returns {string}
 */
function makeServerSIPURI() {
  /* eslint new-cap:0 */
  return `orchestrator@${constants.REGISTRAR_SERVER}`;
}

function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Ensure that the given function is called once per tick.
 * @param {function} fn - Function to be executed
 * @returns {function} - Schedules the given function to be called on the next tick
 */
function oncePerTick(fn) {
  let timeout = null;

  function nextTick() {
    timeout = null;
    fn();
  }

  return function scheduleNextTick() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(nextTick);
  };
}

function promiseFromEvents(operation, eventEmitter, successEvent, failureEvent) {
  return new Promise((resolve, reject) => {
    function onSuccess() {
      const args = [].slice.call(arguments);
      if (failureEvent) {
        eventEmitter.removeListener(failureEvent, onFailure);
      }
      resolve(...args);
    }
    function onFailure() {
      const args = [].slice.call(arguments);
      eventEmitter.removeListener(successEvent, onSuccess);
      reject(...args);
    }
    eventEmitter.once(successEvent, onSuccess);
    if (failureEvent) {
      eventEmitter.once(failureEvent, onFailure);
    }
    operation();
  });
}

/**
 * Traverse down multiple nodes on an object and return null if
 * any link in the path is unavailable.
 * @param {Object} obj - Object to traverse
 * @param {String} path - Path to traverse. Period-separated.
 * @returns {Any|null}
 */
function getOrNull(obj, path) {
  return path.split('.').reduce((output, step) => {
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
  const deferred = {};
  deferred.promise = new Promise((resolve, reject) => {
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
  if (methodName in wrapper) {
    // Skip any methods already set.
    return;
  } else if (methodName.match(/^on[a-z]+$/)) {
    // Skip EventHandlers (these are handled in the constructor).
    return;
  }

  let type;
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
  wrapper[methodName] = function(...args) {
    return this[target][methodName](...args);
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
  for (const methodName in source) {
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
  Object.getOwnPropertyNames(source).forEach(propertyName => {
    proxyProperty(source, wrapper, target, propertyName);
  });
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

    target.addEventListener(propertyName.slice(2), function(...args) {
      wrapper.dispatchEvent(...args);
    });

    return;
  }

  Object.defineProperty(wrapper, propertyName, {
    enumerable: true,
    get() {
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
    return promise.then(result => {
      onSuccess(result);
    }, error => {
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
 * @param {Track} track
 * @param {?boolean} [local=undefined]
 * @returns {string}
 */
function trackClass(track, local) {
  local = local ? 'Local' : '';
  return `${local + (track.kind || '').replace(/\w{1}/, m => m.toUpperCase())}Track`;
}

/**
 * Get the {@link TrackPublication}'s derived class name
 * @param {TrackPublication} publication
 * @param {?boolean} [local=undefined]
 * @returns {string}
 */
function trackPublicationClass(publication, local) {
  local = local ? 'Local' : '';
  return `${local + (publication.kind || '').replace(/\w{1}/, m => m.toUpperCase())}TrackPublication`;
}

/**
 * Throw if the given track is not a {@link LocalAudioTrack}, a
 * {@link LocalVideoTrack} or a MediaStreamTrack.
 * @param {*} track
 * @param {object} options
 */
function validateLocalTrack(track, options) {
  if (!(track instanceof options.LocalAudioTrack
    || track instanceof options.LocalDataTrack
    || track instanceof options.LocalVideoTrack
    || track instanceof options.MediaStreamTrack)) {
    throw constants.typeErrors.INVALID_TYPE('track',
      'LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
  }
}

/**
 * Checks if the a number is in the range [min, max].
 * @private
 * @param {num} num
 * @param {number} min
 * @param {number} max
 * @return {boolean}
 */
function inRange(num, min, max) {
  return min <= num && num <= max;
}

exports.constants = constants;
exports.asLocalTrack = asLocalTrack;
exports.asLocalTrackPublication = asLocalTrackPublication;
exports.capitalize = capitalize;
exports.deprecateEvents = deprecateEvents;
exports.difference = difference;
exports.filterObject = filterObject;
exports.flatMap = flatMap;
exports.getUserAgent = getUserAgent;
exports.inRange = inRange;
exports.makeClientSIPURI = makeClientSIPURI;
exports.makeServerSIPURI = makeServerSIPURI;
exports.makeUUID = makeUUID;
exports.oncePerTick = oncePerTick;
exports.promiseFromEvents = promiseFromEvents;
exports.getOrNull = getOrNull;
exports.defer = defer;
exports.delegateMethods = delegateMethods;
exports.proxyProperties = proxyProperties;
exports.legacyPromise = legacyPromise;
exports.buildLogLevels = buildLogLevels;
exports.trackClass = trackClass;
exports.trackPublicationClass = trackPublicationClass;
exports.validateLocalTrack = validateLocalTrack;
