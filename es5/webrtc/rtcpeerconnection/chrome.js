/* globals RTCDataChannel, RTCPeerConnection, RTCSessionDescription */
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var ChromeRTCSessionDescription = require('../rtcsessiondescription/chrome');
var EventTarget = require('../../eventtarget');
var Latch = require('../util/latch');
var MediaStream = require('../mediastream');
var RTCRtpSenderShim = require('../rtcrtpsender');
var _a = require('../util/sdp'), getSdpFormat = _a.getSdpFormat, updatePlanBTrackIdsToSSRCs = _a.updatePlanBTrackIdsToSSRCs, updateUnifiedPlanTrackIdsToSSRCs = _a.updateUnifiedPlanTrackIdsToSSRCs;
var _b = require('../util'), delegateMethods = _b.delegateMethods, interceptEvent = _b.interceptEvent, isIOSChrome = _b.isIOSChrome, legacyPromise = _b.legacyPromise, proxyProperties = _b.proxyProperties;
var isUnifiedPlan = getSdpFormat() === 'unified';
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
var ChromeRTCPeerConnection = /** @class */ (function (_super) {
    __extends(ChromeRTCPeerConnection, _super);
    function ChromeRTCPeerConnection(configuration, constraints) {
        if (configuration === void 0) { configuration = {}; }
        var _this = _super.call(this) || this;
        var newConfiguration = Object.assign(configuration.iceTransportPolicy
            ? { iceTransports: configuration.iceTransportPolicy }
            : {}, configuration);
        interceptEvent(_this, 'datachannel');
        interceptEvent(_this, 'signalingstatechange');
        var sdpFormat = getSdpFormat(newConfiguration.sdpSemantics);
        var peerConnection = new RTCPeerConnection(newConfiguration, constraints);
        Object.defineProperties(_this, {
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
        peerConnection.addEventListener('datachannel', function (event) {
            shimDataChannel(event.channel);
            _this.dispatchEvent(event);
        });
        peerConnection.addEventListener('signalingstatechange', function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (peerConnection.signalingState === 'stable') {
                _this._appliedTracksToSSRCs = new Map(_this._tracksToSSRCs);
            }
            if (!_this._pendingLocalOffer && !_this._pendingRemoteOffer) {
                _this.dispatchEvent.apply(_this, __spreadArray([], __read(args)));
            }
        });
        peerConnection.ontrack = function () {
            // NOTE(mroberts): adapter.js's "track" event shim only kicks off if we set
            // the ontrack property of the RTCPeerConnection.
        };
        if (typeof peerConnection.addTrack !== 'function') {
            peerConnection.addStream(_this._localStream);
        }
        proxyProperties(RTCPeerConnection.prototype, _this, peerConnection);
        return _this;
    }
    Object.defineProperty(ChromeRTCPeerConnection.prototype, "localDescription", {
        get: function () {
            return this._pendingLocalOffer ? this._pendingLocalOffer : this._peerConnection.localDescription;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChromeRTCPeerConnection.prototype, "remoteDescription", {
        get: function () {
            return this._pendingRemoteOffer ? this._pendingRemoteOffer : this._peerConnection.remoteDescription;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ChromeRTCPeerConnection.prototype, "signalingState", {
        get: function () {
            if (this._pendingLocalOffer) {
                return 'have-local-offer';
            }
            else if (this._pendingRemoteOffer) {
                return 'have-remote-offer';
            }
            return this._peerConnection.signalingState;
        },
        enumerable: false,
        configurable: true
    });
    // NOTE(mmalavalli): This shim supports our limited case of adding
    // all MediaStreamTracks to one MediaStream. It has been implemented this
    // keeping in mind that this is to be maintained only until "addTrack" is
    // supported natively in Chrome.
    ChromeRTCPeerConnection.prototype.addTrack = function (track) {
        var _a;
        var rest = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            rest[_i - 1] = arguments[_i];
        }
        if (typeof this._peerConnection.addTrack === 'function') {
            return (_a = this._peerConnection).addTrack.apply(_a, __spreadArray([track], __read(rest)));
        }
        if (this._peerConnection.signalingState === 'closed') {
            throw new Error("Cannot add MediaStreamTrack [" + track.id + ", \n        " + track.kind + "]: RTCPeerConnection is closed");
        }
        var sender = this._senders.get(track);
        if (sender && sender.track) {
            throw new Error("Cannot add MediaStreamTrack ['" + track.id + ", \n        " + track.kind + "]: RTCPeerConnection already has it");
        }
        this._peerConnection.removeStream(this._localStream);
        this._localStream.addTrack(track);
        this._peerConnection.addStream(this._localStream);
        sender = new RTCRtpSenderShim(track);
        this._senders.set(track, sender);
        return sender;
    };
    // NOTE(mmalavalli): This shim supports our limited case of removing
    // MediaStreamTracks from one MediaStream. It has been implemented this
    // keeping in mind that this is to be maintained only until "removeTrack" is
    // supported natively in Chrome.
    ChromeRTCPeerConnection.prototype.removeTrack = function (sender) {
        if (this._peerConnection.signalingState === 'closed') {
            throw new Error('Cannot remove MediaStreamTrack: RTCPeerConnection is closed');
        }
        if (typeof this._peerConnection.addTrack === 'function') {
            try {
                return this._peerConnection.removeTrack(sender);
            }
            catch (e) {
                // NOTE(mhuynh): Do nothing. In Chrome, will throw if a 'sender was not
                // created by this peer connection'. This behavior does not seem to be
                // spec compliant, so a temporary shim is introduced. A bug has been filed,
                // and is tracked here:
                // https://bugs.chromium.org/p/chromium/issues/detail?id=860853
            }
        }
        else {
            var track = sender.track;
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
    };
    ChromeRTCPeerConnection.prototype.getSenders = function () {
        if (typeof this._peerConnection.addTrack === 'function') {
            return this._peerConnection.getSenders();
        }
        return Array.from(this._senders.values());
    };
    ChromeRTCPeerConnection.prototype.addIceCandidate = function (candidate) {
        var _this = this;
        var rest = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            rest[_i - 1] = arguments[_i];
        }
        var promise;
        if (this.signalingState === 'have-remote-offer') {
            // NOTE(mroberts): Because the ChromeRTCPeerConnection simulates the
            // "have-remote-offer" signalingStates, we only want to invoke the true
            // addIceCandidates method when the remote description has been applied.
            promise = this._signalingStateLatch.when('low').then(function () {
                return _this._peerConnection.addIceCandidate(candidate);
            });
        }
        else {
            promise = this._peerConnection.addIceCandidate(candidate);
        }
        return rest.length > 0
            ? legacyPromise.apply(void 0, __spreadArray([promise], __read(rest))) : promise;
    };
    // NOTE(mroberts): The WebRTC spec does not specify that close should throw an
    // Error; however, in Chrome it does. We workaround this by checking the
    // signalingState manually.
    ChromeRTCPeerConnection.prototype.close = function () {
        if (this.signalingState !== 'closed') {
            this._pendingLocalOffer = null;
            this._pendingRemoteOffer = null;
            this._peerConnection.close();
        }
    };
    // NOTE(mroberts): Because we workaround Chrome's lack of rollback support by
    // "faking" setRemoteDescription, we cannot create an answer until we actually
    // apply the remote description. This means, once you call createAnswer, you
    // can no longer rollback. This is acceptable for our use case because we will
    // apply the newly-created answer almost immediately; however, this may be
    // unacceptable for other use cases.
    ChromeRTCPeerConnection.prototype.createAnswer = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var promise;
        if (this._pendingRemoteOffer) {
            promise = this._peerConnection.setRemoteDescription(this._pendingRemoteOffer).then(function () {
                // NOTE(mroberts): The signalingStates between the ChromeRTCPeerConnection
                // and the underlying RTCPeerConnection implementation have converged. We
                // can unblock any pending calls to addIceCandidate now.
                _this._signalingStateLatch.lower();
                return _this._peerConnection.createAnswer();
            }).then(function (answer) {
                _this._pendingRemoteOffer = null;
                // NOTE(mmalavalli): If createAnswer() is called immediately after rolling back, then we no
                // longer need to retain the rolled back tracks to SSRCs Map.
                _this._rolledBackTracksToSSRCs.clear();
                return new ChromeRTCSessionDescription({
                    type: 'answer',
                    sdp: updateTrackIdsToSSRCs(_this._sdpFormat, _this._tracksToSSRCs, answer.sdp)
                });
            }, function (error) {
                _this._pendingRemoteOffer = null;
                throw error;
            });
        }
        else {
            promise = this._peerConnection.createAnswer().then(function (answer) {
                // NOTE(mmalavalli): If createAnswer() is called immediately after rolling back, then we no
                // longer need to retain the rolled back tracks to SSRCs Map.
                _this._rolledBackTracksToSSRCs.clear();
                return new ChromeRTCSessionDescription({
                    type: 'answer',
                    sdp: updateTrackIdsToSSRCs(_this._sdpFormat, _this._tracksToSSRCs, answer.sdp)
                });
            });
        }
        return args.length > 1
            ? legacyPromise.apply(void 0, __spreadArray([promise], __read(args))) : promise;
    };
    ChromeRTCPeerConnection.prototype.createOffer = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _a = __read(args, 3), arg1 = _a[0], arg2 = _a[1], arg3 = _a[2];
        var options = arg3 || arg1 || {};
        if (isIOSChrome()) {
            // NOTE (joma): From SafariRTCPeerConnection in order to support iOS Chrome.
            if (options.offerToReceiveVideo && !this._audioTransceiver && !(isUnifiedPlan && hasReceiversForTracksOfKind(this, 'audio'))) {
                delete options.offerToReceiveAudio;
                try {
                    this._audioTransceiver = isUnifiedPlan
                        ? this.addTransceiver('audio', { direction: 'recvonly' })
                        : this.addTransceiver('audio');
                }
                catch (e) {
                    return Promise.reject(e);
                }
            }
            if (options.offerToReceiveVideo && !this._videoTransceiver && !(isUnifiedPlan && hasReceiversForTracksOfKind(this, 'video'))) {
                delete options.offerToReceiveVideo;
                try {
                    this._videoTransceiver = isUnifiedPlan
                        ? this.addTransceiver('video', { direction: 'recvonly' })
                        : this.addTransceiver('video');
                }
                catch (e) {
                    return Promise.reject(e);
                }
            }
        }
        var promise = this._peerConnection.createOffer(options).then(function (offer) {
            // NOTE(mmalavalli): If createOffer() is called immediately after rolling back, then we no
            // longer need to retain the rolled back tracks to SSRCs Map.
            _this._rolledBackTracksToSSRCs.clear();
            return new ChromeRTCSessionDescription({
                type: offer.type,
                sdp: updateTrackIdsToSSRCs(_this._sdpFormat, _this._tracksToSSRCs, offer.sdp)
            });
        });
        return args.length > 1
            ? legacyPromise(promise, arg1, arg2)
            : promise;
    };
    ChromeRTCPeerConnection.prototype.createDataChannel = function (label, dataChannelDict) {
        dataChannelDict = shimDataChannelInit(dataChannelDict);
        var dataChannel = this._peerConnection.createDataChannel(label, dataChannelDict);
        shimDataChannel(dataChannel);
        return dataChannel;
    };
    ChromeRTCPeerConnection.prototype.setLocalDescription = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _a = __read(args, 3), description = _a[0], arg1 = _a[1], arg2 = _a[2];
        // NOTE(mmalavalli): If setLocalDescription() is called immediately after rolling back,
        // then we need to restore the rolled back tracks to SSRCs Map.
        if (this._rolledBackTracksToSSRCs.size > 0) {
            this._tracksToSSRCs = new Map(this._rolledBackTracksToSSRCs);
            this._rolledBackTracksToSSRCs.clear();
        }
        var promise = setDescription(this, true, description);
        return args.length > 1
            ? legacyPromise(promise, arg1, arg2)
            : promise;
    };
    ChromeRTCPeerConnection.prototype.setRemoteDescription = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _a = __read(args, 3), description = _a[0], arg1 = _a[1], arg2 = _a[2];
        // NOTE(mmalavalli): If setRemoteDescription() is called immediately after rolling back,
        // then we no longer need to retain the rolled back tracks to SSRCs Map.
        this._rolledBackTracksToSSRCs.clear();
        var promise = setDescription(this, false, description);
        return args.length > 1
            ? legacyPromise(promise, arg1, arg2)
            : promise;
    };
    return ChromeRTCPeerConnection;
}(EventTarget));
delegateMethods(RTCPeerConnection.prototype, ChromeRTCPeerConnection.prototype, '_peerConnection');
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
        }
        else {
            peerConnection._pendingRemoteOffer = offer;
        }
    }
    function clearPendingLocalOffer() {
        if (local) {
            peerConnection._pendingLocalOffer = null;
        }
        else {
            peerConnection._pendingRemoteOffer = null;
        }
    }
    var pendingLocalOffer = local ? peerConnection._pendingLocalOffer : peerConnection._pendingRemoteOffer;
    var pendingRemoteOffer = local ? peerConnection._pendingRemoteOffer : peerConnection._pendingLocalOffer;
    var intermediateState = local ? 'have-local-offer' : 'have-remote-offer';
    var setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';
    var promise;
    if (!local && pendingRemoteOffer && description.type === 'answer') {
        promise = setRemoteAnswer(peerConnection, description);
    }
    else if (description.type === 'offer') {
        if (peerConnection.signalingState !== intermediateState && peerConnection.signalingState !== 'stable') {
            // NOTE(mroberts): Error message copied from Firefox.
            return Promise.reject(new Error("Cannot set " + (local ? 'local' : 'remote') + " offer in state " + peerConnection.signalingState));
        }
        // We need to save this local offer in case of a rollback. We also need to
        // check to see if the signalingState between the ChromeRTCPeerConnection
        // and the underlying RTCPeerConnection implementation are about to diverge.
        // If so, we need to ensure subsequent calls to addIceCandidate will block.
        if (!pendingLocalOffer && peerConnection._signalingStateLatch.state === 'low') {
            peerConnection._signalingStateLatch.raise();
        }
        var previousSignalingState = peerConnection.signalingState;
        setPendingLocalOffer(unwrap(description));
        promise = Promise.resolve();
        // Only dispatch a signalingstatechange event if we transitioned.
        if (peerConnection.signalingState !== previousSignalingState) {
            promise.then(function () { return peerConnection.dispatchEvent(new Event('signalingstatechange')); });
        }
    }
    else if (description.type === 'rollback') {
        if (peerConnection.signalingState !== intermediateState) {
            // NOTE(mroberts): Error message copied from Firefox.
            promise = Promise.reject(new Error("Cannot rollback " + (local ? 'local' : 'remote') + " description in " + peerConnection.signalingState));
        }
        else {
            // Reset the pending offer.
            clearPendingLocalOffer();
            // NOTE(mmalavalli): We store the rolled back tracks to SSRCs Map here in case
            // setLocalDescription() is called immediately after a rollback (without calling
            // createOffer() or createAnswer()), in which case this roll back is not due to a
            // glare scenario and this Map should be restored.
            peerConnection._rolledBackTracksToSSRCs = new Map(peerConnection._tracksToSSRCs);
            peerConnection._tracksToSSRCs = new Map(peerConnection._appliedTracksToSSRCs);
            promise = Promise.resolve();
            promise.then(function () { return peerConnection.dispatchEvent(new Event('signalingstatechange')); });
        }
    }
    return promise || peerConnection._peerConnection[setLocalDescription](unwrap(description));
}
function setRemoteAnswer(peerConnection, answer) {
    // Apply the pending local offer.
    var pendingLocalOffer = peerConnection._pendingLocalOffer;
    return peerConnection._peerConnection.setLocalDescription(pendingLocalOffer).then(function () {
        peerConnection._pendingLocalOffer = null;
        return peerConnection.setRemoteDescription(answer);
    }).then(function () {
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
    return !!peerConnection.getTransceivers().find(function (_a) {
        var _b = _a.receiver, receiver = _b === void 0 ? {} : _b;
        var _c = receiver.track, track = _c === void 0 ? {} : _c;
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
//# sourceMappingURL=chrome.js.map