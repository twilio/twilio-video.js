'use strict';

var Q = require('q');

/**
 * This function is very similar to <code>navigator.getUserMedia</code> except
 * that it does not use callbacks and returns a Promise for a MediaStream
 * @param {MediaStreamConstraints} [constraints={audio:true,video:true}] - the
 *   MediaStreamConstraints object specifying what kind of LocalMediaStream to
 *   request from the browser (by default both audio and video)
 * @returns Promise<MediaStream>
 */
function getUserMedia(constraints) {
  var deferred = Q.defer();
  constraints = constraints || { 'audio': true, 'video': true };
  _getUserMedia(constraints,
    deferred.resolve.bind(deferred),
    deferred.reject.bind(deferred));
  return deferred.promise;
}

function _getUserMedia(constraints, onSuccess, onFailure) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.webkitGetUserMedia === 'function') {
      navigator.webkitGetUserMedia(constraints, onSuccess, onFailure);
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      navigator.mozGetUserMedia(constraints, onSuccess, onFailure);
    }
    return;
  }
  onFailure(new Error('getUserMedia is not supported'));
}

module.exports = getUserMedia;
