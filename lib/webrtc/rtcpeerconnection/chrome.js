/* globals RTCPeerConnection, RTCSessionDescription */
'use strict';

const EventTarget = require('../../eventtarget');
const { updateTrackIdsToSSRCs } = require('../util/sdp');
const { delegateMethods, interceptEvent, isIOSChrome, proxyProperties } = require('../util');

class ChromeRTCPeerConnection extends EventTarget {
  constructor(configuration = {}, constraints) {
    super();

    interceptEvent(this, 'signalingstatechange');
    const peerConnection = new RTCPeerConnection(configuration, constraints);

    Object.defineProperties(this, {
      _appliedTracksToSSRCs: {
        value: new Map(),
        writable: true
      },
      _peerConnection: {
        value: peerConnection
      },
      _rolledBackTracksToSSRCs: {
        value: new Map(),
        writable: true
      },
      _senders: {
        value: new Map()
      },
      _tracksToSSRCs: {
        value: new Map(),
        writable: true
      }
    });

    peerConnection.addEventListener('signalingstatechange', (...args) => {
      if (peerConnection.signalingState === 'stable') {
        this._appliedTracksToSSRCs = new Map(this._tracksToSSRCs);
      }
      this.dispatchEvent(...args);
    });

    proxyProperties(RTCPeerConnection.prototype, this, peerConnection);
  }

  createAnswer(options = {}) {
    return createLocalDescription(this, options, 'answer');
  }

  createOffer(options = {}) {
    if (isIOSChrome()) {
      // NOTE(joma): From SafariRTCPeerConnection in order to support iOS Chrome.
      if (options.offerToReceiveVideo && !this._audioTransceiver && !hasReceiversForTracksOfKind(this, 'audio')) {
        delete options.offerToReceiveAudio;
        try {
          this._audioTransceiver = this.addTransceiver('audio', { direction: 'recvonly' });
        } catch (e) {
          return Promise.reject(e);
        }
      }

      if (options.offerToReceiveVideo && !this._videoTransceiver && !hasReceiversForTracksOfKind(this, 'video')) {
        delete options.offerToReceiveVideo;
        try {
          this._videoTransceiver = this.addTransceiver('video', { direction: 'recvonly' });
        } catch (e) {
          return Promise.reject(e);
        }
      }
    }
    return createLocalDescription(this, options, 'offer');
  }

  setLocalDescription(description) {
    if (description.type === 'rollback') {
      // NOTE(mmalavalli): Since Chrome does not throw an exception when setLocalDescription()
      // is called in the signaling state 'have-remote-offer', we do so here. This is done
      // to preserve the legacy behavior which is consistent with Firefox and Safari.
      if (this.signalingState === 'have-remote-offer') {
        return Promise.reject(new DOMException('Failed to execute '
          + '\'setLocalDescription\' on \'RTCPeerConnection\': '
          + 'Called in wrong signalingState: '
          + this.signalingState, 'InvalidStateError'));
      }
      // NOTE(mmalavalli): We store the rolled back tracks to SSRCs Map here in case
      // setLocalDescription() is called immediately after a rollback (without calling
      // createOffer() or createAnswer()), in which case this roll back is not due to a
      // glare scenario and this Map should be restored.
      this._rolledBackTracksToSSRCs = new Map(this._tracksToSSRCs);
      this._tracksToSSRCs = new Map(this._appliedTracksToSSRCs);
    } else if (this._rolledBackTracksToSSRCs.size > 0) {
      // NOTE(mmalavalli): If setLocalDescription() is called immediately after rolling back,
      // then we need to restore the rolled back tracks to SSRCs Map.
      this._tracksToSSRCs = new Map(this._rolledBackTracksToSSRCs);
      this._rolledBackTracksToSSRCs.clear();
    }
    return this._peerConnection.setLocalDescription(description);
  }

  setRemoteDescription(description) {
    if (['offer', 'rollback'].includes(description.type)) {
      // NOTE(mmalavalli): Since Chrome does not throw an exception when setLocalDescription()
      // is called in the signaling state 'have-remote-offer', we do so here. This is done
      // to preserve the legacy behavior which is consistent with Firefox and Safari
      if (this.signalingState === 'have-local-offer') {
        return Promise.reject(new DOMException('Failed to execute '
          + '\'setLocalDescription\' on \'RTCPeerConnection\': '
          + 'Called in wrong signalingState: '
          + this.signalingState, 'InvalidStateError'));
      }
    }

    // NOTE(mmalavalli): If setRemoteDescription() is called immediately after rolling back,
    // then we no longer need to retain the rolled back tracks to SSRCs Map.
    this._rolledBackTracksToSSRCs.clear();

    return this._peerConnection.setRemoteDescription(description);
  }
}

delegateMethods(
  RTCPeerConnection.prototype,
  ChromeRTCPeerConnection.prototype,
  '_peerConnection');

/**
 * Create a local RTCSessionDescription.
 * @param {ChromeRTCPeerConnection} chromeRTCPeerConnection
 * @param {*} options
 * @param {'answer'|'offer'} type
 * @return {Promise<RTCSessionDescription>}
 */
function createLocalDescription({
  _peerConnection: peerConnection,
  _rolledBackTracksToSSRCs: rolledBackTracksToSSRCs,
  _tracksToSSRCs: tracksToSSRCs
}, options, type) {
  const { createAnswer, createOffer } = peerConnection;
  const createDescription = { answer: createAnswer, offer: createOffer }[type];
  return createDescription.call(peerConnection, options).then(({ sdp }) => {
    // NOTE(mmalavalli): If createAnswer() and createOffer() is called immediately after
    // rolling back, then we no longer need to retain the rolled back tracks to SSRCs Map.
    rolledBackTracksToSSRCs.clear();
    return new RTCSessionDescription({
      sdp: updateTrackIdsToSSRCs(tracksToSSRCs, sdp),
      type
    });
  });
}

/**
 * Whether a ChromeRTCPeerConnection has any RTCRtpReceivers(s) for the given
 * MediaStreamTrack kind.
 * @param {ChromeRTCPeerConnection} peerConnection
 * @param {'audio' | 'video'} kind
 * @returns {boolean}
 */
function hasReceiversForTracksOfKind(peerConnection, kind) {
  return !!peerConnection.getTransceivers().find(({ receiver = {} }) => {
    const { track = {} } = receiver;
    return track.kind === kind;
  });
}

module.exports = ChromeRTCPeerConnection;
