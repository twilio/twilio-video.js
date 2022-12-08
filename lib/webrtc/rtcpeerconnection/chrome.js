/* globals RTCDataChannel, RTCPeerConnection, RTCSessionDescription */
'use strict';

const ChromeRTCSessionDescription = require('../rtcsessiondescription/chrome');
const EventTarget = require('../../eventtarget');
const Latch = require('../util/latch');
const MediaStream = require('../mediastream');
const RTCRtpSenderShim = require('../rtcrtpsender');
const { getSdpFormat, updatePlanBTrackIdsToSSRCs, updateUnifiedPlanTrackIdsToSSRCs } = require('../util/sdp');
const { delegateMethods, interceptEvent, isIOSChrome, legacyPromise, proxyProperties } = require('../util');

const isUnifiedPlan = getSdpFormat() === 'unified';

// NOTE(mroberts): This class wraps Chrome's RTCPeerConnection implementation.
// It provides some functionality not currently present in Chrome, namely the
// abilities to
//
//   1. Rollback, per the workaround suggested here:
//      https://bugs.chromium.org/p/webrtc/issues/detail?id=5738#c3
//
//   2. Listen for track events, per the adapter.js workaround.
//
//   3. Set iceTransportPolicy.
//
class ChromeRTCPeerConnection extends EventTarget {
  constructor(configuration = {}, constraints) {
    super();

    const newConfiguration = Object.assign(configuration.iceTransportPolicy
      ? { iceTransports: configuration.iceTransportPolicy }
      : {}, configuration);

    interceptEvent(this, 'datachannel');
    interceptEvent(this, 'signalingstatechange');
    const sdpFormat = getSdpFormat(newConfiguration.sdpSemantics);
    const peerConnection = new RTCPeerConnection(newConfiguration, constraints);

    Object.defineProperties(this, {
      _appliedTracksToSSRCs: {
        value: new Map(),
        writable: true
      },
      _localStream: {
        value: new MediaStream()
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
      _sdpFormat: {
        value: sdpFormat
      },
      _senders: {
        value: new Map()
      },
      _signalingStateLatch: {
        value: new Latch()
      },
      _tracksToSSRCs: {
        value: new Map(),
        writable: true
      }
    });

    peerConnection.addEventListener('datachannel', event => {
      shimDataChannel(event.channel);
      this.dispatchEvent(event);
    });

    peerConnection.addEventListener('signalingstatechange', (...args) => {
      if (peerConnection.signalingState === 'stable') {
        this._appliedTracksToSSRCs = new Map(this._tracksToSSRCs);
      }
      if (!this._pendingLocalOffer && !this._pendingRemoteOffer) {
        this.dispatchEvent(...args);
      }
    });

    peerConnection.ontrack = () => {
      // NOTE(mroberts): adapter.js's "track" event shim only kicks off if we set
      // the ontrack property of the RTCPeerConnection.
    };

    if (typeof peerConnection.addTrack !== 'function') {
      peerConnection.addStream(this._localStream);
    }
    proxyProperties(RTCPeerConnection.prototype, this, peerConnection);
  }

  get localDescription() {
    return this._pendingLocalOffer ? this._pendingLocalOffer : this._peerConnection.localDescription;
  }

  get remoteDescription() {
    return this._pendingRemoteOffer ? this._pendingRemoteOffer : this._peerConnection.remoteDescription;
  }

  get signalingState() {
    if (this._pendingLocalOffer) {
      return 'have-local-offer';
    } else if (this._pendingRemoteOffer) {
      return 'have-remote-offer';
    }
    return this._peerConnection.signalingState;
  }

  // NOTE(mmalavalli): This shim supports our limited case of adding
  // all MediaStreamTracks to one MediaStream. It has been implemented this
  // keeping in mind that this is to be maintained only until "addTrack" is
  // supported natively in Chrome.
  addTrack(track, ...rest) {
    if (typeof this._peerConnection.addTrack === 'function') {
      return this._peerConnection.addTrack(track, ...rest);
    }
    if (this._peerConnection.signalingState === 'closed') {
      throw new Error(`Cannot add MediaStreamTrack [${track.id}, 
        ${track.kind}]: RTCPeerConnection is closed`);
    }

    let sender = this._senders.get(track);
    if (sender && sender.track) {
      throw new Error(`Cannot add MediaStreamTrack ['${track.id}, 
        ${track.kind}]: RTCPeerConnection already has it`);
    }
    this._peerConnection.removeStream(this._localStream);
    this._localStream.addTrack(track);
    this._peerConnection.addStream(this._localStream);
    sender = new RTCRtpSenderShim(track);
    this._senders.set(track, sender);
    return sender;
  }

  // NOTE(mmalavalli): This shim supports our limited case of removing
  // MediaStreamTracks from one MediaStream. It has been implemented this
  // keeping in mind that this is to be maintained only until "removeTrack" is
  // supported natively in Chrome.
  removeTrack(sender) {
    if (this._peerConnection.signalingState === 'closed') {
      throw new Error('Cannot remove MediaStreamTrack: RTCPeerConnection is closed');
    }
    if (typeof this._peerConnection.addTrack === 'function') {
      try {
        return this._peerConnection.removeTrack(sender);
      } catch (e) {
        // NOTE(mhuynh): Do nothing. In Chrome, will throw if a 'sender was not
        // created by this peer connection'. This behavior does not seem to be
        // spec compliant, so a temporary shim is introduced. A bug has been filed,
        // and is tracked here:
        // https://bugs.chromium.org/p/chromium/issues/detail?id=860853
      }
    } else {
      const { track } = sender;
      if (!track) {
        return;
      }
      sender = this._senders.get(track);
      if (sender && sender.track) {
        sender.track = null;
        this._peerConnection.removeStream(this._localStream);
        this._localStream.removeTrack(track);
        this._peerConnection.addStream(this._localStream);
      }
    }
  }

  getSenders() {
    if (typeof this._peerConnection.addTrack === 'function') {
      return this._peerConnection.getSenders();
    }
    return Array.from(this._senders.values());
  }

  addIceCandidate(candidate, ...rest) {
    let promise;

    if (this.signalingState === 'have-remote-offer') {
      // NOTE(mroberts): Because the ChromeRTCPeerConnection simulates the
      // "have-remote-offer" signalingStates, we only want to invoke the true
      // addIceCandidates method when the remote description has been applied.
      promise = this._signalingStateLatch.when('low').then(() =>
        this._peerConnection.addIceCandidate(candidate));
    } else {
      promise = this._peerConnection.addIceCandidate(candidate);
    }

    return rest.length > 0
      ? legacyPromise(promise, ...rest)
      : promise;
  }

  // NOTE(mroberts): The WebRTC spec does not specify that close should throw an
  // Error; however, in Chrome it does. We workaround this by checking the
  // signalingState manually.
  close() {
    if (this.signalingState !== 'closed') {
      this._pendingLocalOffer = null;
      this._pendingRemoteOffer = null;
      this._peerConnection.close();
    }
  }

  // NOTE(mroberts): Because we workaround Chrome's lack of rollback support by
  // "faking" setRemoteDescription, we cannot create an answer until we actually
  // apply the remote description. This means, once you call createAnswer, you
  // can no longer rollback. This is acceptable for our use case because we will
  // apply the newly-created answer almost immediately; however, this may be
  // unacceptable for other use cases.
  createAnswer(...args) {
    let promise;

    if (this._pendingRemoteOffer) {
      promise = this._peerConnection.setRemoteDescription(this._pendingRemoteOffer).then(() => {
        // NOTE(mroberts): The signalingStates between the ChromeRTCPeerConnection
        // and the underlying RTCPeerConnection implementation have converged. We
        // can unblock any pending calls to addIceCandidate now.
        this._signalingStateLatch.lower();
        return this._peerConnection.createAnswer();
      }).then(answer => {
        this._pendingRemoteOffer = null;

        // NOTE(mmalavalli): If createAnswer() is called immediately after rolling back, then we no
        // longer need to retain the rolled back tracks to SSRCs Map.
        this._rolledBackTracksToSSRCs.clear();

        return new ChromeRTCSessionDescription({
          type: 'answer',
          sdp: updateTrackIdsToSSRCs(this._sdpFormat, this._tracksToSSRCs, answer.sdp)
        });
      }, error => {
        this._pendingRemoteOffer = null;
        throw error;
      });
    } else {
      promise = this._peerConnection.createAnswer().then(answer => {
        // NOTE(mmalavalli): If createAnswer() is called immediately after rolling back, then we no
        // longer need to retain the rolled back tracks to SSRCs Map.
        this._rolledBackTracksToSSRCs.clear();

        return new ChromeRTCSessionDescription({
          type: 'answer',
          sdp: updateTrackIdsToSSRCs(this._sdpFormat, this._tracksToSSRCs, answer.sdp)
        });
      });
    }

    return args.length > 1
      ? legacyPromise(promise, ...args)
      : promise;
  }

  createOffer(...args) {
    const [arg1, arg2, arg3] = args;
    const options = arg3 || arg1 || {};

    if (isIOSChrome()) {
      // NOTE (joma): From SafariRTCPeerConnection in order to support iOS Chrome.
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
    }

    const promise = this._peerConnection.createOffer(options).then(offer => {
      // NOTE(mmalavalli): If createOffer() is called immediately after rolling back, then we no
      // longer need to retain the rolled back tracks to SSRCs Map.
      this._rolledBackTracksToSSRCs.clear();

      return new ChromeRTCSessionDescription({
        type: offer.type,
        sdp: updateTrackIdsToSSRCs(this._sdpFormat, this._tracksToSSRCs, offer.sdp)
      });
    });

    return args.length > 1
      ? legacyPromise(promise, arg1, arg2)
      : promise;
  }

  createDataChannel(label, dataChannelDict) {
    dataChannelDict = shimDataChannelInit(dataChannelDict);
    const dataChannel = this._peerConnection.createDataChannel(label, dataChannelDict);
    shimDataChannel(dataChannel);
    return dataChannel;
  }

  setLocalDescription(...args) {
    const [description, arg1, arg2] = args;

    // NOTE(mmalavalli): If setLocalDescription() is called immediately after rolling back,
    // then we need to restore the rolled back tracks to SSRCs Map.
    if (this._rolledBackTracksToSSRCs.size > 0) {
      this._tracksToSSRCs = new Map(this._rolledBackTracksToSSRCs);
      this._rolledBackTracksToSSRCs.clear();
    }

    const promise = setDescription(this, true, description);
    return args.length > 1
      ? legacyPromise(promise, arg1, arg2)
      : promise;
  }

  setRemoteDescription(...args) {
    const [description, arg1, arg2] = args;

    // NOTE(mmalavalli): If setRemoteDescription() is called immediately after rolling back,
    // then we no longer need to retain the rolled back tracks to SSRCs Map.
    this._rolledBackTracksToSSRCs.clear();

    const promise = setDescription(this, false, description);
    return args.length > 1
      ? legacyPromise(promise, arg1, arg2)
      : promise;
  }
}

delegateMethods(
  RTCPeerConnection.prototype,
  ChromeRTCPeerConnection.prototype,
  '_peerConnection');

// NOTE(mroberts): We workaround Chrome's lack of rollback support, per the
// workaround suggested here: https://bugs.chromium.org/p/webrtc/issues/detail?id=5738#c3
// Namely, we "fake" setting the local or remote description and instead buffer
// it. If we receive or create an answer, then we will actually apply the
// description. Until we receive or create an answer, we will be able to
// "rollback" by simply discarding the buffer description.
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
  let promise;

  if (!local && pendingRemoteOffer && description.type === 'answer') {
    promise = setRemoteAnswer(peerConnection, description);
  } else if (description.type === 'offer') {
    if (peerConnection.signalingState !== intermediateState && peerConnection.signalingState !== 'stable') {
      // NOTE(mroberts): Error message copied from Firefox.
      return Promise.reject(new Error(`Cannot set ${local ? 'local' : 'remote'} offer in state ${peerConnection.signalingState}`));
    }

    // We need to save this local offer in case of a rollback. We also need to
    // check to see if the signalingState between the ChromeRTCPeerConnection
    // and the underlying RTCPeerConnection implementation are about to diverge.
    // If so, we need to ensure subsequent calls to addIceCandidate will block.
    if (!pendingLocalOffer && peerConnection._signalingStateLatch.state === 'low') {
      peerConnection._signalingStateLatch.raise();
    }
    const previousSignalingState = peerConnection.signalingState;
    setPendingLocalOffer(unwrap(description));
    promise = Promise.resolve();

    // Only dispatch a signalingstatechange event if we transitioned.
    if (peerConnection.signalingState !== previousSignalingState) {
      promise.then(() => peerConnection.dispatchEvent(new Event('signalingstatechange')));
    }

  } else if (description.type === 'rollback') {
    if (peerConnection.signalingState !== intermediateState) {
      // NOTE(mroberts): Error message copied from Firefox.
      promise = Promise.reject(new Error(`Cannot rollback ${local ? 'local' : 'remote'} description in ${peerConnection.signalingState}`));
    } else {
      // Reset the pending offer.
      clearPendingLocalOffer();

      // NOTE(mmalavalli): We store the rolled back tracks to SSRCs Map here in case
      // setLocalDescription() is called immediately after a rollback (without calling
      // createOffer() or createAnswer()), in which case this roll back is not due to a
      // glare scenario and this Map should be restored.
      peerConnection._rolledBackTracksToSSRCs = new Map(peerConnection._tracksToSSRCs);
      peerConnection._tracksToSSRCs = new Map(peerConnection._appliedTracksToSSRCs);

      promise = Promise.resolve();
      promise.then(() => peerConnection.dispatchEvent(new Event('signalingstatechange')));
    }
  }

  return promise || peerConnection._peerConnection[setLocalDescription](unwrap(description));
}

function setRemoteAnswer(peerConnection, answer) {
  // Apply the pending local offer.
  const pendingLocalOffer = peerConnection._pendingLocalOffer;
  return peerConnection._peerConnection.setLocalDescription(pendingLocalOffer).then(() => {
    peerConnection._pendingLocalOffer = null;
    return peerConnection.setRemoteDescription(answer);
  }).then(() => {
    // NOTE(mroberts): The signalingStates between the ChromeRTCPeerConnection
    // and the underlying RTCPeerConnection implementation have converged. We
    // can unblock any pending calls to addIceCandidate now.
    peerConnection._signalingStateLatch.lower();
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

function unwrap(description) {
  if (description instanceof ChromeRTCSessionDescription) {
    if (description._description) {
      return description._description;
    }
  }
  return new RTCSessionDescription(description);
}

/**
 * Check whether or not we need to apply our maxPacketLifeTime shim. We are
 * pretty conservative: we'll only apply it if the legacy maxRetransmitTime
 * property is available _and_ the standard maxPacketLifeTime property is _not_
 * available (the thinking being that Chrome will land the standards-compliant
 * property).
 * @returns {boolean}
 */
function needsMaxPacketLifeTimeShim() {
  return 'maxRetransmitTime' in RTCDataChannel.prototype
    && !('maxPacketLifeTime' in RTCDataChannel.prototype);
}

/**
 * Shim an RTCDataChannelInit dictionary (if necessary). This function returns
 * a copy of the original RTCDataChannelInit.
 * @param {RTCDataChannelInit} dataChannelDict
 * @returns {RTCDataChannelInit}
 */
function shimDataChannelInit(dataChannelDict) {
  dataChannelDict = Object.assign({}, dataChannelDict);
  if (needsMaxPacketLifeTimeShim() && 'maxPacketLifeTime' in dataChannelDict) {
    dataChannelDict.maxRetransmitTime = dataChannelDict.maxPacketLifeTime;
  }
  return dataChannelDict;
}

/**
 * Shim an RTCDataChannel (if necessary). This function mutates the
 * RTCDataChannel.
 * @param {RTCDataChannel} dataChannel
 * @returns {RTCDataChannel}
 */
function shimDataChannel(dataChannel) {
  Object.defineProperty(dataChannel, 'maxRetransmits', {
    value: dataChannel.maxRetransmits === 65535
      ? null
      : dataChannel.maxRetransmits
  });
  if (needsMaxPacketLifeTimeShim()) {
    // NOTE(mroberts): We can rename `maxRetransmitTime` to `maxPacketLifeTime`.
    //
    //   https://bugs.chromium.org/p/chromium/issues/detail?id=696681
    //
    Object.defineProperty(dataChannel, 'maxPacketLifeTime', {
      value: dataChannel.maxRetransmitTime === 65535
        ? null
        : dataChannel.maxRetransmitTime
    });
  }
  return dataChannel;
}

/**
 * Update the mappings from MediaStreamTrack IDs to SSRCs as indicated by both
 * the Map from MediaStreamTrack IDs to SSRCs and the SDP itself. This method
 * ensures that SSRCs never change once announced.
 * @param {'planb'|'unified'} sdpFormat
 * @param {Map<string, Set<string>>} tracksToSSRCs
 * @param {string} sdp - an SDP whose format is determined by `sdpSemantics`
 * @returns {string} updatedSdp - updated SDP
 */
function updateTrackIdsToSSRCs(sdpFormat, tracksToSSRCs, sdp) {
  return sdpFormat === 'unified'
    ? updateUnifiedPlanTrackIdsToSSRCs(tracksToSSRCs, sdp)
    : updatePlanBTrackIdsToSSRCs(tracksToSSRCs, sdp);
}

module.exports = ChromeRTCPeerConnection;
