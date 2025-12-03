// @ts-check
'use strict';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var filterObject = require('../../util').filterObject;
/** @typedef {Object} IceCandidatePayload
 * Definition for local and remote ICE candidate telemetry payloads
 * @property {string} [candidateType] - Alias for RTCIceCandidate.type
 * @property {string} [ip] - Alias for RTCIceCandidate.address
 * @property {number} [port]
 * @property {number} [priority]
 * @property {string} [protocol]
 * @property {string} [relatedAddress]
 * @property {number} [relatedPort]
 * @property {string} [tcpType]
 * @property {string} [transportId] - Alias for RTCIceCandidate.sdpMid
*/
/**
 * PeerConnection telemetry events
 * @internal
 */
var PeerConnectionEvents = /** @class */ (function () {
    /**
     * @param {import('../telemetry')} telemetry - The telemetry instance
     */
    function PeerConnectionEvents(telemetry) {
        this._telemetry = telemetry;
    }
    /**
     * Emit connection state change event
     * @param {string} peerConnectionId - Peer connection identifier
     * @param {('new'|'connecting'|'connected'|'disconnected'|'failed'|'closed')} state - Connection state
     * @returns {void}
     */
    PeerConnectionEvents.prototype.connectionState = function (peerConnectionId, state) {
        this._telemetry.debug({
            group: 'pc-connection-state',
            name: state,
            payload: { peerConnectionId: peerConnectionId }
        });
    };
    /**
     * Emit signaling state change event
     * @param {string} peerConnectionId - Peer connection identifier
     * @param {('stable'|'have-local-offer'|'have-remote-offer'|'have-local-pranswer'|'have-remote-pranswer'|'closed')} state - Signaling state
     * @returns {void}
     */
    PeerConnectionEvents.prototype.signalingState = function (peerConnectionId, state) {
        this._telemetry.debug({
            group: 'pc-signaling-state',
            name: state,
            payload: { peerConnectionId: peerConnectionId }
        });
    };
    /**
     * Emit ice gathering state change event
     * @param {string} peerConnectionId - Peer connection identifier
     * @param {('new'|'gathering'|'complete')} state - Ice gathering state
     * @returns {void}
     */
    PeerConnectionEvents.prototype.iceGatheringState = function (peerConnectionId, state) {
        this._telemetry.debug({
            group: 'ice-gathering-state',
            name: state,
            payload: { peerConnectionId: peerConnectionId }
        });
    };
    /**
     * Emit ice connection state change event
     * @param {string} peerConnectionId - Peer connection identifier
     * @param {('new'|'checking'|'connected'|'completed'|'disconnected'|'failed'|'closed')} state - Ice connection state
     * @returns {void}
     */
    PeerConnectionEvents.prototype.iceConnectionState = function (peerConnectionId, state) {
        var level = state === 'failed' ? 'error' : 'debug';
        this._telemetry[level]({
            group: 'ice-connection-state',
            name: state,
            payload: { peerConnectionId: peerConnectionId }
        });
    };
    /**
     * Emit DTLS transport state change event
     * @param {string} peerConnectionId - Peer connection identifier
     * @param {('new'|'connecting'|'connected'|'closed'|'failed')} state - DTLS transport state
     * @returns {void}
     */
    PeerConnectionEvents.prototype.dtlsTransportState = function (peerConnectionId, state) {
        var level = state === 'failed' ? 'error' : 'debug';
        this._telemetry[level]({
            group: 'dtls-transport-state',
            name: state,
            payload: { peerConnectionId: peerConnectionId }
        });
    };
    /**
     * Emit a telemetry event when a new ICE candidate is added
     * @param {string} peerConnectionId - The peer connection identifier
     * @param {RTCIceCandidate} iceCandidate - The native RTCIceCandidate object
     * @param {boolean} [isRemote = false] - Whether the candidate is remote
     * @returns {void}
     */
    PeerConnectionEvents.prototype.iceCandidate = function (peerConnectionId, iceCandidate, isRemote) {
        if (isRemote === void 0) { isRemote = false; }
        this._telemetry.debug({
            group: 'ice-candidate',
            name: 'ice-candidate',
            payload: __assign({ peerConnectionId: peerConnectionId, isRemote: isRemote ? 'true' : 'false' }, this._toIceCandidatePayload(iceCandidate))
        });
    };
    /**
     * Emit a telemetry event when the selected ICE candidate pair changes
     * @param {string} peerConnectionId - The peer connection identifier
     * @param {RTCIceCandidatePair} pair - The selected candidate pair
     * @returns {void}
     */
    PeerConnectionEvents.prototype.selectedCandidatePair = function (peerConnectionId, pair) {
        this._telemetry.debug({
            group: 'ice-candidate',
            name: 'selected-ice-candidate-pair',
            payload: filterObject({
                peerConnectionId: peerConnectionId,
                localCandidate: pair.local ? this._toIceCandidatePayload(pair.local) : null,
                remoteCandidate: pair.remote ? this._toIceCandidatePayload(pair.remote) : null
            }, null)
        });
    };
    /**
     * Convert RTCIceCandidate to telemetry payload format
     * @private
     * @param {RTCIceCandidate} iceCandidate - The RTCIceCandidate object
     * @returns {IceCandidatePayload} The telemetry payload format
     */
    PeerConnectionEvents.prototype._toIceCandidatePayload = function (iceCandidate) {
        return filterObject({
            'candidateType': iceCandidate.type,
            'ip': iceCandidate.address,
            'port': iceCandidate.port,
            'priority': iceCandidate.priority,
            'protocol': iceCandidate.protocol,
            'relatedAddress': iceCandidate.relatedAddress,
            'relatedPort': iceCandidate.relatedPort,
            'tcpType': iceCandidate.tcpType,
            'transportId': iceCandidate.sdpMid
        }, null);
    };
    return PeerConnectionEvents;
}());
module.exports = PeerConnectionEvents;
//# sourceMappingURL=peerconnection.js.map