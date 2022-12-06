/* globals RTCPeerConnection, RTCSessionDescription */
'use strict';

const EventTarget = require('../../eventtarget');
const Latch = require('../util/latch');
const { getSdpFormat, updatePlanBTrackIdsToSSRCs, updateUnifiedPlanTrackIdsToSSRCs } = require('../util/sdp');
const { delegateMethods, interceptEvent, proxyProperties } = require('../util');

const isUnifiedPlan = getSdpFormat() === 'unified';

const updateTrackIdsToSSRCs = isUnifiedPlan
  ? updateUnifiedPlanTrackIdsToSSRCs
  : updatePlanBTrackIdsToSSRCs;

class SafariRTCPeerConnection extends EventTarget {
  constructor(configuration) {
    super();

    interceptEvent(this, 'datachannel');
    interceptEvent(this, 'iceconnectionstatechange');
    interceptEvent(this, 'signalingstatechange');
    interceptEvent(this, 'track');

    const peerConnection = new RTCPeerConnection(configuration);

    Object.defineProperties(this, {
      _appliedTracksToSSRCs: {
        value: new Map(),
        writable: true
      },
      _audioTransceiver: {
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
      _pendingLocalOffer: {
        value: null,
        writable: true
      },
      _pendingRemoteOffer: {
        value: null,
        writable: true
      },
      _rolledBackTracksToSSRCs: {
        value: new Map(),
        writable: true
      },
      _signalingStateLatch: {
        value: new Latch()
      },
      _tracksToSSRCs: {
        value: new Map(),
        writable: true
      },
      _videoTransceiver: {
        value: null,
        writable: true
      }
    });

    peerConnection.addEventListener('datachannel', event => {
      shimDataChannel(event.channel);
      this.dispatchEvent(event);
    });

    peerConnection.addEventListener('iceconnectionstatechange', (...args) => {
      if (this._isClosed) {
        return;
      }
      this.dispatchEvent(...args);
    });

    peerConnection.addEventListener('signalingstatechange', (...args) => {
      if (this._isClosed) {
        return;
      }
      if (peerConnection.signalingState === 'stable') {
        this._appliedTracksToSSRCs = new Map(this._tracksToSSRCs);
      }
      if (!this._pendingLocalOffer && !this._pendingRemoteOffer) {
        this.dispatchEvent(...args);
      }
    });

    // NOTE(syerrapragada): This ensures that SafariRTCPeerConnection's "remoteDescription", when accessed
    // in an RTCTrackEvent listener, will point to the underlying RTCPeerConnection's
    // "remoteDescription". Before this fix, this was still pointing to "_pendingRemoteOffer"
    // even though a new remote RTCSessionDescription had already been applied.
    peerConnection.addEventListener('track', event => {
      this._pendingRemoteOffer = null;
      this.dispatchEvent(event);
    });

    proxyProperties(RTCPeerConnection.prototype, this, peerConnection);

  }

  get localDescription() {
    return this._pendingLocalOffer || this._peerConnection.localDescription;
  }

  get iceConnectionState() {
    return this._isClosed ? 'closed' : this._peerConnection.iceConnectionState;
  }

  get iceGatheringState() {
    return this._isClosed ? 'complete' : this._peerConnection.iceGatheringState;
  }

  get remoteDescription() {
    return this._pendingRemoteOffer || this._peerConnection.remoteDescription;
  }

  get signalingState() {
    if (this._isClosed) {
      return 'closed';
    } else if (this._pendingLocalOffer) {
      return 'have-local-offer';
    } else if (this._pendingRemoteOffer) {
      return 'have-remote-offer';
    }
    return this._peerConnection.signalingState;
  }

  addIceCandidate(candidate) {
    if (this.signalingState === 'have-remote-offer') {
      return this._signalingStateLatch.when('low').then(() => this._peerConnection.addIceCandidate(candidate));
    }
    return this._peerConnection.addIceCandidate(candidate);
  }

  createOffer(options) {
    options = Object.assign({}, options);

    // NOTE(mroberts): In general, this is not the way to do this; however, it's
    // good enough for our application.
    if (options.offerToReceiveVideo && !this._audioTransceiver && !(isUnifiedPlan && hasReceiversForTracksOfKind(this, 'audio'))) {
      delete options.offerToReceiveAudio;
      try {
        this._audioTransceiver = isUnifiedPlan
          ? this.addTransceiver('audio', { direction: 'recvonly' })
          : this.addTransceiver('audio');
      } catch (e) {
        return Promise.reject(e);
      }
    }

    if (options.offerToReceiveVideo && !this._videoTransceiver && !(isUnifiedPlan && hasReceiversForTracksOfKind(this, 'video'))) {
      delete options.offerToReceiveVideo;
      try {
        this._videoTransceiver = isUnifiedPlan
          ? this.addTransceiver('video', { direction: 'recvonly' })
          : this.addTransceiver('video');
      } catch (e) {
        return Promise.reject(e);
      }
    }

    return this._peerConnection.createOffer(options).then(offer => {
      // NOTE(mmalavalli): If createOffer() is called immediately after rolling back,
      // then we no longer need to retain the rolled back tracks to SSRCs Map.
      this._rolledBackTracksToSSRCs.clear();

      return new RTCSessionDescription({
        type: offer.type,
        sdp: updateTrackIdsToSSRCs(this._tracksToSSRCs, offer.sdp)
      });
    });
  }

  createAnswer(options) {
    if (this._pendingRemoteOffer) {
      return this._peerConnection.setRemoteDescription(this._pendingRemoteOffer).then(() => {
        this._signalingStateLatch.lower();
        return this._peerConnection.createAnswer();
      }).then(answer => {
        this._pendingRemoteOffer = null;

        // NOTE(mmalavalli): If createAnswer() is called immediately after rolling back, then we no
        // longer need to retain the rolled back tracks to SSRCs Map.
        this._rolledBackTracksToSSRCs.clear();

        return isUnifiedPlan ? new RTCSessionDescription({
          type: answer.type,
          sdp: updateTrackIdsToSSRCs(this._tracksToSSRCs, answer.sdp)
        }) : answer;
      }, error => {
        this._pendingRemoteOffer = null;
        throw error;
      });
    }

    return this._peerConnection.createAnswer(options).then(answer => {
      // NOTE(mmalavalli): If createAnswer() is called immediately after rolling back, then we no
      // longer need to retain the rolled back tracks to SSRCs Map.
      this._rolledBackTracksToSSRCs.clear();

      return isUnifiedPlan ? new RTCSessionDescription({
        type: answer.type,
        sdp: updateTrackIdsToSSRCs(this._tracksToSSRCs, answer.sdp)
      }) : answer;
    });
  }

  createDataChannel(label, dataChannelDict) {
    const dataChannel = this._peerConnection.createDataChannel(label, dataChannelDict);
    shimDataChannel(dataChannel);
    return dataChannel;
  }

  removeTrack(sender) {
    sender.replaceTrack(null);
    this._peerConnection.removeTrack(sender);
  }

  setLocalDescription(description) {
    // NOTE(mmalavalli): If setLocalDescription() is called immediately after rolling back,
    // then we need to restore the rolled back tracks to SSRCs Map.
    if (this._rolledBackTracksToSSRCs.size > 0) {
      this._tracksToSSRCs = new Map(this._rolledBackTracksToSSRCs);
      this._rolledBackTracksToSSRCs.clear();
    }
    return setDescription(this, true, description);
  }

  setRemoteDescription(description) {
    // NOTE(mmalavalli): If setRemoteDescription() is called immediately after rolling back,
    // then we no longer need to retain the rolled back tracks to SSRCs Map.
    this._rolledBackTracksToSSRCs.clear();
    return setDescription(this, false, description);
  }

  close() {
    if (this._isClosed) {
      return;
    }
    this._isClosed = true;
    this._peerConnection.close();
    setTimeout(() => {
      this.dispatchEvent(new Event('iceconnectionstatechange'));
      this.dispatchEvent(new Event('signalingstatechange'));
    });
  }
}

delegateMethods(
  RTCPeerConnection.prototype,
  SafariRTCPeerConnection.prototype,
  '_peerConnection');

function setDescription(peerConnection, local, description) {
  function setPendingLocalOffer(offer) {
    if (local) {
      peerConnection._pendingLocalOffer = offer;
    } else {
      peerConnection._pendingRemoteOffer = offer;
    }
  }

  function clearPendingLocalOffer() {
    if (local) {
      peerConnection._pendingLocalOffer = null;
    } else {
      peerConnection._pendingRemoteOffer = null;
    }
  }

  const pendingLocalOffer = local ? peerConnection._pendingLocalOffer : peerConnection._pendingRemoteOffer;
  const pendingRemoteOffer = local ? peerConnection._pendingRemoteOffer : peerConnection._pendingLocalOffer;
  const intermediateState = local ? 'have-local-offer' : 'have-remote-offer';
  const setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';

  if (!local && pendingRemoteOffer && description.type === 'answer') {
    return setRemoteAnswer(peerConnection, description);
  } else if (description.type === 'offer') {
    if (peerConnection.signalingState !== intermediateState && peerConnection.signalingState !== 'stable') {
      return Promise.reject(new Error(`Cannot set ${local ? 'local' : 'remote'}
        offer in state ${peerConnection.signalingState}`));
    }

    if (!pendingLocalOffer && peerConnection._signalingStateLatch.state === 'low') {
      peerConnection._signalingStateLatch.raise();
    }
    const previousSignalingState = peerConnection.signalingState;
    setPendingLocalOffer(description);

    // Only dispatch a signalingstatechange event if we transitioned.
    if (peerConnection.signalingState !== previousSignalingState) {
      return Promise.resolve().then(() => peerConnection.dispatchEvent(new Event('signalingstatechange')));
    }

    return Promise.resolve();
  } else if (description.type === 'rollback') {
    if (peerConnection.signalingState !== intermediateState) {
      return Promise.reject(new Error(`Cannot rollback 
        ${local ? 'local' : 'remote'} description in ${peerConnection.signalingState}`));
    }
    clearPendingLocalOffer();

    // NOTE(mmalavalli): We store the rolled back tracks to SSRCs Map here in case
    // setLocalDescription() is called immediately aftera rollback (without calling
    // createOffer() or createAnswer()), in which case this roll back is not due to
    // a glare scenario and this Map should be restored.
    peerConnection._rolledBackTracksToSSRCs = new Map(peerConnection._tracksToSSRCs);
    peerConnection._tracksToSSRCs = new Map(peerConnection._appliedTracksToSSRCs);

    return Promise.resolve().then(() => peerConnection.dispatchEvent(new Event('signalingstatechange')));
  }

  return peerConnection._peerConnection[setLocalDescription](description);
}

function setRemoteAnswer(peerConnection, answer) {
  const pendingLocalOffer = peerConnection._pendingLocalOffer;
  return peerConnection._peerConnection.setLocalDescription(pendingLocalOffer).then(() => {
    peerConnection._pendingLocalOffer = null;
    return peerConnection.setRemoteDescription(answer);
  }).then(() => peerConnection._signalingStateLatch.lower());
}

/**
 * Whether a SafariRTCPeerConnection has any RTCRtpReceivers(s) for the given
 * MediaStreamTrack kind.
 * @param {SafariRTCPeerConnection} peerConnection
 * @param {'audio' | 'video'} kind
 * @returns {boolean}
 */
function hasReceiversForTracksOfKind(peerConnection, kind) {
  return !!peerConnection.getTransceivers().find(({ receiver = {} }) => {
    const { track = {} } = receiver;
    return track.kind === kind;
  });
}

/**
 * Shim an RTCDataChannel. This function mutates the RTCDataChannel.
 * @param {RTCDataChannel} dataChannel
 * @returns {RTCDataChannel}
 */
function shimDataChannel(dataChannel) {
  return Object.defineProperties(dataChannel, {
    maxPacketLifeTime: {
      value: dataChannel.maxPacketLifeTime === 65535
        ? null
        : dataChannel.maxPacketLifeTime
    },
    maxRetransmits: {
      value: dataChannel.maxRetransmits === 65535
        ? null
        : dataChannel.maxRetransmits
    }
  });
}

module.exports = SafariRTCPeerConnection;
