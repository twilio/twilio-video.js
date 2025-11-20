'use strict';
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
    return PeerConnectionEvents;
}());
module.exports = PeerConnectionEvents;
//# sourceMappingURL=peerconnection.js.map