/* globals mozRTCPeerConnection */
'use strict';

var EventTarget = require('../../eventtarget');
var FirefoxRTCSessionDescription = require('../rtcsessiondescription/firefox');
var inherits = require('util').inherits;
var util = require('../../util');

// NOTE(mroberts): This class wraps Firefox's RTCPeerConnection implementation.
// It provides some functionality not currently present in Firefox, namely the
// abilities to
//
//   1. Call setLocalDescription and setRemoteDescription with new offers in
//      signalingStates "have-local-offer" and "have-remote-offer",
//      respectively.
//
//   2. The ability to call createOffer in signalingState "have-local-offer".
//
// Both of these are implemented using rollbacks to workaround the following
// bug:
//
//   https://bugzilla.mozilla.org/show_bug.cgi?id=1072388
//
function FirefoxRTCPeerConnection(configuration) {
  if (!(this instanceof FirefoxRTCPeerConnection)) {
    return new FirefoxRTCPeerConnection(configuration);
  }

  EventTarget.call(this);

  var onsignalingstatechange = null;

  /* eslint new-cap:0 */
  var peerConnection = new mozRTCPeerConnection(configuration);

  Object.defineProperties(this, {
    _isClosed: {
      value: false,
      writable: true
    },
    _peerConnection: {
      value: peerConnection
    },
    _rollingBack: {
      value: false,
      writable: true
    },
    iceGatheringState: {
      enumerable: true,
      get: function() {
        return this._isClosed ? 'complete' : this._peerConnection.iceGatheringState;
      }
    },
    onsignalingstatechange: {
      get: function() {
        return onsignalingstatechange;
      },
      set: function(_onsignalingstatechange) {
        if (onsignalingstatechange) {
          this.removeEventListener('signalingstatechange', onsignalingstatechange);
        }

        if (typeof _onsignalingstatechange === 'function') {
          onsignalingstatechange = _onsignalingstatechange;
          this.addEventListener('signalingstatechange', onsignalingstatechange);
        } else {
          onsignalingstatechange = null;
        }
      }
    },
    signalingState: {
      enumerable: true,
      get: function() {
        return this._isClosed ? 'closed' : this._peerConnection.signalingState;
      }
    }
  });

  var self = this;
  var previousSignalingState;

  peerConnection.addEventListener('signalingstatechange', function onsignalingstatechange() {
    if (!self._rollingBack && self.signalingState !== previousSignalingState) {
      previousSignalingState = self.signalingState;

      // NOTE(mmalavalli): In Firefox, 'signalingstatechange' event is
      // triggered synchronously in the same tick after
      // RTCPeerConnection#close() is called. So we mimic Chrome's behavior
      // by triggering 'signalingstatechange' on the next tick.
      var dispatchEventToSelf = self.dispatchEvent.apply.bind(self.dispatchEvent, self, arguments);
      if (self._isClosed) {
        setTimeout(dispatchEventToSelf);
      } else {
        dispatchEventToSelf();
      }
    }
  });

  util.proxyProperties(mozRTCPeerConnection.prototype, this, peerConnection);

  // NOTE(mroberts): We use the adapter.js workaround for providing track events.
  if (!('ontrack' in mozRTCPeerConnection.prototype)) {
    peerConnection.addEventListener('addstream', function onaddstream(addStreamEvent) {
      var mediaStream = addStreamEvent.stream;

      // NOTE(mmalavalli): We are not using MediaStream#onaddtrack event listeners
      // for shimming PeerConnection#ontrack like we do for Chrome because it
      // is not yet supported in Firefox (support is slated for Firefox 50).
      // That's why we don't see this event being used in adapter.js's Firefox
      // shim.
      // Reference: https://developer.mozilla.org/en-US/docs/Web/API/MediaStream#Browser_compatibility

      mediaStream.getTracks().forEach(function(mediaStreamTrack) {
        var newEvent = new Event('track');
        newEvent.track = mediaStreamTrack;
        newEvent.streams = [mediaStream];
        self.dispatchEvent(newEvent);
      });
    });
  }
}

inherits(FirefoxRTCPeerConnection, EventTarget);

// NOTE(mmalavalli): Firefox throws an exception when
// RTCPeerConnection#getRemoteStreams() is called after it is 'closed'.
// Expected behavior is to return an empty array.
// Bugzilla: https://bugzilla.mozilla.org/show_bug.cgi?id=1154084
FirefoxRTCPeerConnection.prototype.getRemoteStreams = function getRemoteStreams() {
    return this._isClosed ? [] : this._peerConnection.getRemoteStreams();
};

// NOTE(mmalavalli): Firefox does not support RTCPeerConnection#removeStream(),
// and calling it will screw up the RTCPeerConnection's internal state. So
// for now, we don't do anything when it is called.
// Bugzilla: https://bugzilla.mozilla.org/show_bug.cgi?id=842455
FirefoxRTCPeerConnection.prototype.removeStream = function removeStream() {};

// NOTE(mmalavalli): Firefox throws an exception if
// RTCPeerConnection#addStream() tries to add an already added stream. So,
// we check to make sure the new stream is not already added.
// Bugzilla: https://bugzilla.mozilla.org/show_bug.cgi?id=825550
FirefoxRTCPeerConnection.prototype.addStream = function addStream(newStream) {
  var localStreams = this._peerConnection.getLocalStreams();
  var exists = localStreams.some(function(stream) {
    return stream === newStream;
  });
  if (!exists) {
    return this._peerConnection.addStream(newStream);
  }
};

// NOTE(mroberts): The WebRTC spec allows you to call createOffer from any
// signalingState other than "closed"; however, Firefox has not yet implemented
// this (https://bugzilla.mozilla.org/show_bug.cgi?id=1072388). We workaround
// this by rolling back if we are in state "have-local-offer" or
// "have-remote-offer". This is acceptable for our use case because we will
// apply the newly-created offer almost immediately; however, this may be
// unacceptable for other use cases.
FirefoxRTCPeerConnection.prototype.createOffer = function createOffer() {
  var args = [].slice.call(arguments);
  var promise;
  var self = this;

  if (this.signalingState === 'have-local-offer' ||
      this.signalingState === 'have-remote-offer') {
    var local = this.signalingState === 'have-local-offer';
    var offerOptions = (args.length > 1 ? args[2] : args[0]) || {};
    promise = rollback(this, local, function rollbackSucceeded() {
      return self.createOffer(offerOptions);
    });
  }

  if (promise) {
    return args.length > 1
      ? util.legacyPromise(promise, args[0], args[1])
      : promise;
  }

  return this._peerConnection.createOffer.apply(this._peerConnection, args);
};

// NOTE(mroberts): While Firefox will reject the Promise returned by
// setLocalDescription when called from signalingState "have-local-offer" with
// an answer, it still updates the .localDescription property. We workaround
// this by explicitly handling this case.
FirefoxRTCPeerConnection.prototype.setLocalDescription = function setLocalDescription() {
  var args = [].slice.call(arguments);
  var description = args[0];
  var promise;

  if (description && description.type === 'answer' && this.signalingState === 'have-local-offer') {
    promise = Promise.reject(new Error('Cannot set local answer in state have-local-offer'));
  }

  if (promise) {
    return args.length > 1
      ? util.legacyPromise(promise, args[1], args[2])
      : promise;
  }

  return this._peerConnection.setLocalDescription.apply(this._peerConnection, args);
};

// NOTE(mroberts): The WebRTC spec allows you to call setRemoteDescription with
// an offer multiple times in signalingState "have-remote-offer"; however,
// Firefox has not yet implemented this (https://bugzilla.mozilla.org/show_bug.cgi?id=1072388).
// We workaround this by rolling back if we are in state "have-remote-offer".
// This is acceptable for our use case; however, this may be unacceptable for
// other use cases.
//
// While Firefox will reject the Promise returned by setRemoteDescription when
// called from signalingState "have-remote-offer" with an answer, it sill
// updates the .remoteDescription property. We workaround this by explicitly
// handling this case.
FirefoxRTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription() {
  var args = [].slice.call(arguments);
  var description = args[0];
  var promise;
  var self = this;

  if (description && this.signalingState === 'have-remote-offer') {
    if (description.type === 'answer') {
      promise = Promise.reject(new Error('Cannot set remote answer in state have-remote-offer'));
    } else if (description.type === 'offer') {
      promise = rollback(this, false, function rollbackSucceeded() {
        return self._peerConnection.setRemoteDescription(description);
      });
    }
  }

  if (promise) {
    return args.length > 1
      ? util.legacyPromise(promise, args[1], args[2])
      : promise;
  }

  return this._peerConnection.setRemoteDescription.apply(this._peerConnection, args);
};

// NOTE(mroberts): The WebRTC spec specifies that the PeerConnection's internal
// isClosed slot should immediately be set to true; however, in Firefox it
// occurs in the next tick. We workaround this by tracking isClosed manually.
FirefoxRTCPeerConnection.prototype.close = function close() {
  if (this.signalingState !== 'closed') {
    this._isClosed = true;
    this._peerConnection.close();
  }
};

util.delegateMethods(
  mozRTCPeerConnection.prototype,
  FirefoxRTCPeerConnection.prototype,
  '_peerConnection');

function rollback(peerConnection, local, onceRolledBack) {
  var setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';
  peerConnection._rollingBack = true;
  return peerConnection._peerConnection[setLocalDescription](new FirefoxRTCSessionDescription({
    type: 'rollback'
  })).then(onceRolledBack).then(function onceRolledBackSucceeded(result) {
    peerConnection._rollingBack = false;
    return result;
  }, function rollbackOrOnceRolledBackFailed(error) {
    peerConnection._rollingBack = false;
    throw error;
  });
}

module.exports = FirefoxRTCPeerConnection;
