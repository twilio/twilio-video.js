/* globals RTCPeerConnection, RTCSessionDescription */
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
var EventTarget = require('../../eventtarget');
var Latch = require('../util/latch');
var _a = require('../util/sdp'), getSdpFormat = _a.getSdpFormat, updatePlanBTrackIdsToSSRCs = _a.updatePlanBTrackIdsToSSRCs, updateUnifiedPlanTrackIdsToSSRCs = _a.updateUnifiedPlanTrackIdsToSSRCs;
var _b = require('../util'), delegateMethods = _b.delegateMethods, interceptEvent = _b.interceptEvent, proxyProperties = _b.proxyProperties;
var isUnifiedPlan = getSdpFormat() === 'unified';
var updateTrackIdsToSSRCs = isUnifiedPlan
    ? updateUnifiedPlanTrackIdsToSSRCs
    : updatePlanBTrackIdsToSSRCs;
var SafariRTCPeerConnection = /** @class */ (function (_super) {
    __extends(SafariRTCPeerConnection, _super);
    function SafariRTCPeerConnection(configuration) {
        var _this = _super.call(this) || this;
        interceptEvent(_this, 'datachannel');
        interceptEvent(_this, 'iceconnectionstatechange');
        interceptEvent(_this, 'signalingstatechange');
        interceptEvent(_this, 'track');
        var peerConnection = new RTCPeerConnection(configuration);
        Object.defineProperties(_this, {
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
        peerConnection.addEventListener('datachannel', function (event) {
            shimDataChannel(event.channel);
            _this.dispatchEvent(event);
        });
        peerConnection.addEventListener('iceconnectionstatechange', function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (_this._isClosed) {
                return;
            }
            _this.dispatchEvent.apply(_this, __spreadArray([], __read(args)));
        });
        peerConnection.addEventListener('signalingstatechange', function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (_this._isClosed) {
                return;
            }
            if (peerConnection.signalingState === 'stable') {
                _this._appliedTracksToSSRCs = new Map(_this._tracksToSSRCs);
            }
            if (!_this._pendingLocalOffer && !_this._pendingRemoteOffer) {
                _this.dispatchEvent.apply(_this, __spreadArray([], __read(args)));
            }
        });
        // NOTE(syerrapragada): This ensures that SafariRTCPeerConnection's "remoteDescription", when accessed
        // in an RTCTrackEvent listener, will point to the underlying RTCPeerConnection's
        // "remoteDescription". Before this fix, this was still pointing to "_pendingRemoteOffer"
        // even though a new remote RTCSessionDescription had already been applied.
        peerConnection.addEventListener('track', function (event) {
            _this._pendingRemoteOffer = null;
            _this.dispatchEvent(event);
        });
        proxyProperties(RTCPeerConnection.prototype, _this, peerConnection);
        return _this;
    }
    Object.defineProperty(SafariRTCPeerConnection.prototype, "localDescription", {
        get: function () {
            return this._pendingLocalOffer || this._peerConnection.localDescription;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SafariRTCPeerConnection.prototype, "iceConnectionState", {
        get: function () {
            return this._isClosed ? 'closed' : this._peerConnection.iceConnectionState;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SafariRTCPeerConnection.prototype, "iceGatheringState", {
        get: function () {
            return this._isClosed ? 'complete' : this._peerConnection.iceGatheringState;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SafariRTCPeerConnection.prototype, "remoteDescription", {
        get: function () {
            return this._pendingRemoteOffer || this._peerConnection.remoteDescription;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SafariRTCPeerConnection.prototype, "signalingState", {
        get: function () {
            if (this._isClosed) {
                return 'closed';
            }
            else if (this._pendingLocalOffer) {
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
    SafariRTCPeerConnection.prototype.addIceCandidate = function (candidate) {
        var _this = this;
        if (this.signalingState === 'have-remote-offer') {
            return this._signalingStateLatch.when('low').then(function () { return _this._peerConnection.addIceCandidate(candidate); });
        }
        return this._peerConnection.addIceCandidate(candidate);
    };
    SafariRTCPeerConnection.prototype.createOffer = function (options) {
        var _this = this;
        options = Object.assign({}, options);
        // NOTE(mroberts): In general, this is not the way to do this; however, it's
        // good enough for our application.
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
        return this._peerConnection.createOffer(options).then(function (offer) {
            // NOTE(mmalavalli): If createOffer() is called immediately after rolling back,
            // then we no longer need to retain the rolled back tracks to SSRCs Map.
            _this._rolledBackTracksToSSRCs.clear();
            return new RTCSessionDescription({
                type: offer.type,
                sdp: updateTrackIdsToSSRCs(_this._tracksToSSRCs, offer.sdp)
            });
        });
    };
    SafariRTCPeerConnection.prototype.createAnswer = function (options) {
        var _this = this;
        if (this._pendingRemoteOffer) {
            return this._peerConnection.setRemoteDescription(this._pendingRemoteOffer).then(function () {
                _this._signalingStateLatch.lower();
                return _this._peerConnection.createAnswer();
            }).then(function (answer) {
                _this._pendingRemoteOffer = null;
                // NOTE(mmalavalli): If createAnswer() is called immediately after rolling back, then we no
                // longer need to retain the rolled back tracks to SSRCs Map.
                _this._rolledBackTracksToSSRCs.clear();
                return isUnifiedPlan ? new RTCSessionDescription({
                    type: answer.type,
                    sdp: updateTrackIdsToSSRCs(_this._tracksToSSRCs, answer.sdp)
                }) : answer;
            }, function (error) {
                _this._pendingRemoteOffer = null;
                throw error;
            });
        }
        return this._peerConnection.createAnswer(options).then(function (answer) {
            // NOTE(mmalavalli): If createAnswer() is called immediately after rolling back, then we no
            // longer need to retain the rolled back tracks to SSRCs Map.
            _this._rolledBackTracksToSSRCs.clear();
            return isUnifiedPlan ? new RTCSessionDescription({
                type: answer.type,
                sdp: updateTrackIdsToSSRCs(_this._tracksToSSRCs, answer.sdp)
            }) : answer;
        });
    };
    SafariRTCPeerConnection.prototype.createDataChannel = function (label, dataChannelDict) {
        var dataChannel = this._peerConnection.createDataChannel(label, dataChannelDict);
        shimDataChannel(dataChannel);
        return dataChannel;
    };
    SafariRTCPeerConnection.prototype.removeTrack = function (sender) {
        sender.replaceTrack(null);
        this._peerConnection.removeTrack(sender);
    };
    SafariRTCPeerConnection.prototype.setLocalDescription = function (description) {
        // NOTE(mmalavalli): If setLocalDescription() is called immediately after rolling back,
        // then we need to restore the rolled back tracks to SSRCs Map.
        if (this._rolledBackTracksToSSRCs.size > 0) {
            this._tracksToSSRCs = new Map(this._rolledBackTracksToSSRCs);
            this._rolledBackTracksToSSRCs.clear();
        }
        return setDescription(this, true, description);
    };
    SafariRTCPeerConnection.prototype.setRemoteDescription = function (description) {
        // NOTE(mmalavalli): If setRemoteDescription() is called immediately after rolling back,
        // then we no longer need to retain the rolled back tracks to SSRCs Map.
        this._rolledBackTracksToSSRCs.clear();
        return setDescription(this, false, description);
    };
    SafariRTCPeerConnection.prototype.close = function () {
        var _this = this;
        if (this._isClosed) {
            return;
        }
        this._isClosed = true;
        this._peerConnection.close();
        setTimeout(function () {
            _this.dispatchEvent(new Event('iceconnectionstatechange'));
            _this.dispatchEvent(new Event('signalingstatechange'));
        });
    };
    return SafariRTCPeerConnection;
}(EventTarget));
delegateMethods(RTCPeerConnection.prototype, SafariRTCPeerConnection.prototype, '_peerConnection');
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
    if (!local && pendingRemoteOffer && description.type === 'answer') {
        return setRemoteAnswer(peerConnection, description);
    }
    else if (description.type === 'offer') {
        if (peerConnection.signalingState !== intermediateState && peerConnection.signalingState !== 'stable') {
            return Promise.reject(new Error("Cannot set " + (local ? 'local' : 'remote') + "\n        offer in state " + peerConnection.signalingState));
        }
        if (!pendingLocalOffer && peerConnection._signalingStateLatch.state === 'low') {
            peerConnection._signalingStateLatch.raise();
        }
        var previousSignalingState = peerConnection.signalingState;
        setPendingLocalOffer(description);
        // Only dispatch a signalingstatechange event if we transitioned.
        if (peerConnection.signalingState !== previousSignalingState) {
            return Promise.resolve().then(function () { return peerConnection.dispatchEvent(new Event('signalingstatechange')); });
        }
        return Promise.resolve();
    }
    else if (description.type === 'rollback') {
        if (peerConnection.signalingState !== intermediateState) {
            return Promise.reject(new Error("Cannot rollback \n        " + (local ? 'local' : 'remote') + " description in " + peerConnection.signalingState));
        }
        clearPendingLocalOffer();
        // NOTE(mmalavalli): We store the rolled back tracks to SSRCs Map here in case
        // setLocalDescription() is called immediately aftera rollback (without calling
        // createOffer() or createAnswer()), in which case this roll back is not due to
        // a glare scenario and this Map should be restored.
        peerConnection._rolledBackTracksToSSRCs = new Map(peerConnection._tracksToSSRCs);
        peerConnection._tracksToSSRCs = new Map(peerConnection._appliedTracksToSSRCs);
        return Promise.resolve().then(function () { return peerConnection.dispatchEvent(new Event('signalingstatechange')); });
    }
    return peerConnection._peerConnection[setLocalDescription](description);
}
function setRemoteAnswer(peerConnection, answer) {
    var pendingLocalOffer = peerConnection._pendingLocalOffer;
    return peerConnection._peerConnection.setLocalDescription(pendingLocalOffer).then(function () {
        peerConnection._pendingLocalOffer = null;
        return peerConnection.setRemoteDescription(answer);
    }).then(function () { return peerConnection._signalingStateLatch.lower(); });
}
/**
 * Whether a SafariRTCPeerConnection has any RTCRtpReceivers(s) for the given
 * MediaStreamTrack kind.
 * @param {SafariRTCPeerConnection} peerConnection
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
//# sourceMappingURL=safari.js.map