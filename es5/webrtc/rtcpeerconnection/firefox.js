/* globals RTCPeerConnection */
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
var FirefoxRTCSessionDescription = require('../rtcsessiondescription/firefox');
var updateTracksToSSRCs = require('../util/sdp').updateUnifiedPlanTrackIdsToSSRCs;
var _a = require('../util'), delegateMethods = _a.delegateMethods, interceptEvent = _a.interceptEvent, legacyPromise = _a.legacyPromise, proxyProperties = _a.proxyProperties;
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
var FirefoxRTCPeerConnection = /** @class */ (function (_super) {
    __extends(FirefoxRTCPeerConnection, _super);
    function FirefoxRTCPeerConnection(configuration) {
        var _this = _super.call(this) || this;
        interceptEvent(_this, 'signalingstatechange');
        /* eslint new-cap:0 */
        var peerConnection = new RTCPeerConnection(configuration);
        Object.defineProperties(_this, {
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
        var previousSignalingState;
        peerConnection.addEventListener('signalingstatechange', function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            if (!_this._rollingBack && _this.signalingState !== previousSignalingState) {
                previousSignalingState = _this.signalingState;
                // NOTE(mmalavalli): In Firefox, 'signalingstatechange' event is
                // triggered synchronously in the same tick after
                // RTCPeerConnection#close() is called. So we mimic Chrome's behavior
                // by triggering 'signalingstatechange' on the next tick.
                if (_this._isClosed) {
                    setTimeout(function () { return _this.dispatchEvent.apply(_this, __spreadArray([], __read(args))); });
                }
                else {
                    _this.dispatchEvent.apply(_this, __spreadArray([], __read(args)));
                }
            }
        });
        proxyProperties(RTCPeerConnection.prototype, _this, peerConnection);
        return _this;
    }
    Object.defineProperty(FirefoxRTCPeerConnection.prototype, "iceGatheringState", {
        get: function () {
            return this._isClosed ? 'complete' : this._peerConnection.iceGatheringState;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FirefoxRTCPeerConnection.prototype, "localDescription", {
        get: function () {
            return overwriteWithInitiallyNegotiatedDtlsRole(this._peerConnection.localDescription, this._initiallyNegotiatedDtlsRole);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(FirefoxRTCPeerConnection.prototype, "signalingState", {
        get: function () {
            return this._isClosed ? 'closed' : this._peerConnection.signalingState;
        },
        enumerable: false,
        configurable: true
    });
    FirefoxRTCPeerConnection.prototype.createAnswer = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var promise;
        promise = this._peerConnection.createAnswer().then(function (answer) {
            saveInitiallyNegotiatedDtlsRole(_this, answer);
            return overwriteWithInitiallyNegotiatedDtlsRole(answer, _this._initiallyNegotiatedDtlsRole);
        });
        return typeof args[0] === 'function'
            ? legacyPromise.apply(void 0, __spreadArray([promise], __read(args))) : promise;
    };
    // NOTE(mroberts): The WebRTC spec allows you to call createOffer from any
    // signalingState other than "closed"; however, Firefox has not yet implemented
    // this (https://bugzilla.mozilla.org/show_bug.cgi?id=1072388). We workaround
    // this by rolling back if we are in state "have-local-offer" or
    // "have-remote-offer". This is acceptable for our use case because we will
    // apply the newly-created offer almost immediately; however, this may be
    // unacceptable for other use cases.
    FirefoxRTCPeerConnection.prototype.createOffer = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _a = __read(args, 3), arg1 = _a[0], arg2 = _a[1], arg3 = _a[2];
        var options = arg3 || arg1 || {};
        var promise;
        if (this.signalingState === 'have-local-offer' ||
            this.signalingState === 'have-remote-offer') {
            var local = this.signalingState === 'have-local-offer';
            promise = rollback(this, local, function () { return _this.createOffer(options); });
        }
        else {
            promise = this._peerConnection.createOffer(options);
        }
        promise = promise.then(function (offer) {
            return new FirefoxRTCSessionDescription({
                type: offer.type,
                sdp: updateTracksToSSRCs(_this._tracksToSSRCs, offer.sdp)
            });
        });
        return args.length > 1
            ? legacyPromise(promise, arg1, arg2)
            : promise;
    };
    // NOTE(mroberts): While Firefox will reject the Promise returned by
    // setLocalDescription when called from signalingState "have-local-offer" with
    // an answer, it still updates the .localDescription property. We workaround
    // this by explicitly handling this case.
    FirefoxRTCPeerConnection.prototype.setLocalDescription = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _b = __read(args), description = _b[0], rest = _b.slice(1);
        var promise;
        if (description && description.type === 'answer' && this.signalingState === 'have-local-offer') {
            promise = Promise.reject(new Error('Cannot set local answer in state have-local-offer'));
        }
        if (promise) {
            return args.length > 1
                ? legacyPromise.apply(void 0, __spreadArray([promise], __read(rest))) : promise;
        }
        return (_a = this._peerConnection).setLocalDescription.apply(_a, __spreadArray([], __read(args)));
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
    FirefoxRTCPeerConnection.prototype.setRemoteDescription = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var _a = __read(args), description = _a[0], rest = _a.slice(1);
        var promise;
        if (description && this.signalingState === 'have-remote-offer') {
            if (description.type === 'answer') {
                promise = Promise.reject(new Error('Cannot set remote answer in state have-remote-offer'));
            }
            else if (description.type === 'offer') {
                promise = rollback(this, false, function () { return _this._peerConnection.setRemoteDescription(description); });
            }
        }
        if (!promise) {
            promise = this._peerConnection.setRemoteDescription(description);
        }
        promise = promise.then(function () { return saveInitiallyNegotiatedDtlsRole(_this, description, true); });
        return args.length > 1
            ? legacyPromise.apply(void 0, __spreadArray([promise], __read(rest))) : promise;
    };
    // NOTE(mroberts): The WebRTC spec specifies that the PeerConnection's internal
    // isClosed slot should immediately be set to true; however, in Firefox it
    // occurs in the next tick. We workaround this by tracking isClosed manually.
    FirefoxRTCPeerConnection.prototype.close = function () {
        if (this.signalingState !== 'closed') {
            this._isClosed = true;
            this._peerConnection.close();
        }
    };
    return FirefoxRTCPeerConnection;
}(EventTarget));
delegateMethods(RTCPeerConnection.prototype, FirefoxRTCPeerConnection.prototype, '_peerConnection');
function rollback(peerConnection, local, onceRolledBack) {
    var setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';
    peerConnection._rollingBack = true;
    return peerConnection._peerConnection[setLocalDescription](new FirefoxRTCSessionDescription({
        type: 'rollback'
    })).then(onceRolledBack).then(function (result) {
        peerConnection._rollingBack = false;
        return result;
    }, function (error) {
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
    var match = description.sdp.match(/a=setup:([a-z]+)/);
    if (!match) {
        return;
    }
    var dtlsRole = match[1];
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
//# sourceMappingURL=firefox.js.map