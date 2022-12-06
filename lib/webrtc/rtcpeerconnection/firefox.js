/* globals RTCPeerConnection */
'use strict';

const EventTarget = require('../../eventtarget');
const FirefoxRTCSessionDescription = require('../rtcsessiondescription/firefox');
const { updateUnifiedPlanTrackIdsToSSRCs: updateTracksToSSRCs } = require('../util/sdp');
const { delegateMethods, interceptEvent, legacyPromise, proxyProperties } = require('../util');

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
// We also provide a workaround for a bug where Firefox may change the
// previously-negotiated DTLS role in an answer, which breaks Chrome:
//
//     https://bugzilla.mozilla.org/show_bug.cgi?id=1240897
//
class FirefoxRTCPeerConnection extends EventTarget {
  constructor(configuration) {
    super();

    interceptEvent(this, 'signalingstatechange');

    /* eslint new-cap:0 */
    const peerConnection = new RTCPeerConnection(configuration);

    Object.defineProperties(this, {
      _initiallyNegotiatedDtlsRole: {
        value: null,
        writable: true
      },
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
      _tracksToSSRCs: {
        value: new Map()
      },

      // NOTE(mmalavalli): Firefox throws a TypeError when the PeerConnection's
      // prototype's "peerIdentity" property is accessed. In order to overcome
      // this, we ignore this property while delegating methods.
      // Reference: https://bugzilla.mozilla.org/show_bug.cgi?id=1363815
      peerIdentity: {
        enumerable: true,
        value: Promise.resolve({
          idp: '',
          name: ''
        })
      }
    });

    let previousSignalingState;

    peerConnection.addEventListener('signalingstatechange', (...args) => {
      if (!this._rollingBack && this.signalingState !== previousSignalingState) {
        previousSignalingState = this.signalingState;

        // NOTE(mmalavalli): In Firefox, 'signalingstatechange' event is
        // triggered synchronously in the same tick after
        // RTCPeerConnection#close() is called. So we mimic Chrome's behavior
        // by triggering 'signalingstatechange' on the next tick.
        if (this._isClosed) {
          setTimeout(() => this.dispatchEvent(...args));
        } else {
          this.dispatchEvent(...args);
        }
      }
    });

    proxyProperties(RTCPeerConnection.prototype, this, peerConnection);
  }

  get iceGatheringState() {
    return this._isClosed ? 'complete' : this._peerConnection.iceGatheringState;
  }

  get localDescription() {
    return overwriteWithInitiallyNegotiatedDtlsRole(this._peerConnection.localDescription, this._initiallyNegotiatedDtlsRole);
  }

  get signalingState() {
    return this._isClosed ? 'closed' : this._peerConnection.signalingState;
  }

  createAnswer(...args) {
    let promise;

    promise = this._peerConnection.createAnswer().then(answer => {
      saveInitiallyNegotiatedDtlsRole(this, answer);
      return overwriteWithInitiallyNegotiatedDtlsRole(answer, this._initiallyNegotiatedDtlsRole);
    });

    return typeof args[0] === 'function'
      ? legacyPromise(promise, ...args)
      : promise;
  }

  // NOTE(mroberts): The WebRTC spec allows you to call createOffer from any
  // signalingState other than "closed"; however, Firefox has not yet implemented
  // this (https://bugzilla.mozilla.org/show_bug.cgi?id=1072388). We workaround
  // this by rolling back if we are in state "have-local-offer" or
  // "have-remote-offer". This is acceptable for our use case because we will
  // apply the newly-created offer almost immediately; however, this may be
  // unacceptable for other use cases.
  createOffer(...args) {
    const [arg1, arg2, arg3] = args;
    const options = arg3 || arg1 || {};
    let promise;

    if (this.signalingState === 'have-local-offer' ||
      this.signalingState === 'have-remote-offer') {
      const local = this.signalingState === 'have-local-offer';
      promise = rollback(this, local, () => this.createOffer(options));
    } else {
      promise = this._peerConnection.createOffer(options);
    }

    promise = promise.then(offer => {
      return new FirefoxRTCSessionDescription({
        type: offer.type,
        sdp: updateTracksToSSRCs(this._tracksToSSRCs, offer.sdp)
      });
    });

    return args.length > 1
      ? legacyPromise(promise, arg1, arg2)
      : promise;
  }

  // NOTE(mroberts): While Firefox will reject the Promise returned by
  // setLocalDescription when called from signalingState "have-local-offer" with
  // an answer, it still updates the .localDescription property. We workaround
  // this by explicitly handling this case.
  setLocalDescription(...args) {
    const [description, ...rest] = args;
    let promise;

    if (description && description.type === 'answer' && this.signalingState === 'have-local-offer') {
      promise = Promise.reject(new Error('Cannot set local answer in state have-local-offer'));
    }

    if (promise) {
      return args.length > 1
        ? legacyPromise(promise, ...rest)
        : promise;
    }

    return this._peerConnection.setLocalDescription(...args);
  }

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
  setRemoteDescription(...args) {
    const [description, ...rest] = args;

    let promise;

    if (description && this.signalingState === 'have-remote-offer') {
      if (description.type === 'answer') {
        promise = Promise.reject(new Error('Cannot set remote answer in state have-remote-offer'));
      } else if (description.type === 'offer') {
        promise = rollback(this, false, () => this._peerConnection.setRemoteDescription(description));
      }
    }

    if (!promise) {
      promise = this._peerConnection.setRemoteDescription(description);
    }

    promise = promise.then(() => saveInitiallyNegotiatedDtlsRole(this, description, true));

    return args.length > 1
      ? legacyPromise(promise, ...rest)
      : promise;
  }

  // NOTE(mroberts): The WebRTC spec specifies that the PeerConnection's internal
  // isClosed slot should immediately be set to true; however, in Firefox it
  // occurs in the next tick. We workaround this by tracking isClosed manually.
  close() {
    if (this.signalingState !== 'closed') {
      this._isClosed = true;
      this._peerConnection.close();
    }
  }
}

delegateMethods(
  RTCPeerConnection.prototype,
  FirefoxRTCPeerConnection.prototype,
  '_peerConnection');

function rollback(peerConnection, local, onceRolledBack) {
  const setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';
  peerConnection._rollingBack = true;
  return peerConnection._peerConnection[setLocalDescription](new FirefoxRTCSessionDescription({
    type: 'rollback'
  })).then(onceRolledBack).then(result => {
    peerConnection._rollingBack = false;
    return result;
  }, error => {
    peerConnection._rollingBack = false;
    throw error;
  });
}

/**
 * Extract the initially negotiated DTLS role out of an RTCSessionDescription's
 * sdp property and save it on the FirefoxRTCPeerConnection if and only if
 *
 *   1. A DTLS role was not already saved on the FirefoxRTCPeerConnection, and
 *   2. The description is an answer.
 *
 * @private
 * @param {FirefoxRTCPeerConnection} peerConnection
 * @param {RTCSessionDescription} description
 * @param {boolean} [remote=false] - if true, save the inverse of the DTLS role,
 *   e.g. "active" instead of "passive" and vice versa
 * @returns {undefined}
 */
function saveInitiallyNegotiatedDtlsRole(peerConnection, description, remote) {
  // NOTE(mroberts): JSEP specifies that offers always offer "actpass" as the
  // DTLS role. We need to inspect answers to figure out the negotiated DTLS
  // role.
  if (peerConnection._initiallyNegotiatedDtlsRole || description.type === 'offer') {
    return;
  }

  const match = description.sdp.match(/a=setup:([a-z]+)/);
  if (!match) {
    return;
  }

  const dtlsRole = match[1];
  peerConnection._initiallyNegotiatedDtlsRole = remote ? {
    active: 'passive',
    passive: 'active'
  }[dtlsRole] : dtlsRole;
}

/**
 * Overwrite the DTLS role in the sdp property of an RTCSessionDescription if
 * and only if
 *
 *   1. The description is an answer, and
 *   2. A DTLS role is provided.
 *
 * @private
 * @param {RTCSessionDescription} [description]
 * @param {string} [dtlsRole] - one of "active" or "passive"
 * @returns {?RTCSessionDescription} description
 */
function overwriteWithInitiallyNegotiatedDtlsRole(description, dtlsRole) {
  if (description && description.type === 'answer' && dtlsRole) {
    return new FirefoxRTCSessionDescription({
      type: description.type,
      sdp: description.sdp.replace(/a=setup:[a-z]+/g, 'a=setup:' + dtlsRole)
    });
  }
  return description;
}

module.exports = FirefoxRTCPeerConnection;
