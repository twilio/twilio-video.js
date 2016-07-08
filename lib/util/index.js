'use strict';

var C = require('./constants');
var map = require('./map');

/**
 * Construct the SIP URI for a client of a particular account.
 * @param {string} accountSid - the Account SID
 * @param {string} clientName - the client name
 * @returns {string}
 */
function makeSIPURI(accountSid, clientName) {
  /* eslint new-cap:0 */
  return encodeURIComponent(clientName) + '@' + C.REGISTRAR_SERVER(accountSid);
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
  var SIPJS = require('sip.js');
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

module.exports.makeSIPURI = makeSIPURI;
module.exports.makeRegistrationSIPURI = makeRegistrationSIPURI;
module.exports.getUser = getUser;
module.exports.makeUUID = makeUUID;
module.exports.promiseFromEvents = promiseFromEvents;
module.exports.parseRoomSIDFromContactHeader = parseRoomSIDFromContactHeader;
module.exports.map = map;
module.exports.defer = defer;
