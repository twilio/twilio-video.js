// @ts-check
'use strict';

const { filterObject } = require('../../util');

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
 * @property {number} [networkCost]
*/

/**
 * PeerConnection telemetry events
 * @internal
 */
class PeerConnectionEvents {
  /**
   * @param {import('../telemetry')} telemetry - The telemetry instance
   */
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit connection state change event
   * @param {string} peerConnectionId - Peer connection identifier
   * @param {('new'|'connecting'|'connected'|'disconnected'|'failed'|'closed')} state - Connection state
   * @returns {void}
   */
  connectionState(peerConnectionId, state) {
    this._telemetry.debug({
      group: 'pc-connection-state',
      name: state,
      payload: { peerConnectionId }
    });
  }

  /**
   * Emit signaling state change event
   * @param {string} peerConnectionId - Peer connection identifier
   * @param {('stable'|'have-local-offer'|'have-remote-offer'|'have-local-pranswer'|'have-remote-pranswer'|'closed')} state - Signaling state
   * @returns {void}
   */
  signalingState(peerConnectionId, state) {
    this._telemetry.debug({
      group: 'pc-signaling-state',
      name: state,
      payload: { peerConnectionId }
    });
  }

  /**
   * Emit ice gathering state change event
   * @param {string} peerConnectionId - Peer connection identifier
   * @param {('new'|'gathering'|'complete')} state - Ice gathering state
   * @returns {void}
   */
  iceGatheringState(peerConnectionId, state) {
    this._telemetry.debug({
      group: 'ice-gathering-state',
      name: state,
      payload: { peerConnectionId }
    });
  }

  /**
   * Emit ice connection state change event
   * @param {string} peerConnectionId - Peer connection identifier
   * @param {('new'|'checking'|'connected'|'completed'|'disconnected'|'failed'|'closed')} state - Ice connection state
   * @returns {void}
   */
  iceConnectionState(peerConnectionId, state) {
    const level = state === 'failed' ? 'error' : 'debug';
    this._telemetry[level]({
      group: 'ice-connection-state',
      name: state,
      payload: { peerConnectionId }
    });
  }

  /**
   * Emit DTLS transport state change event
   * @param {string} peerConnectionId - Peer connection identifier
   * @param {('new'|'connecting'|'connected'|'closed'|'failed')} state - DTLS transport state
   * @returns {void}
   */
  dtlsTransportState(peerConnectionId, state) {
    const level = state === 'failed' ? 'error' : 'debug';
    this._telemetry[level]({
      group: 'dtls-transport-state',
      name: state,
      payload: { peerConnectionId }
    });
  }

  /**
   * Emit a telemetry event when a new ICE candidate is added
   * @param {string} peerConnectionId - The peer connection identifier
   * @param {RTCIceCandidate} iceCandidate - The native RTCIceCandidate object
   * @param {boolean} [isRemote = false] - Whether the candidate is remote
   * @returns {void}
   */
  iceCandidate(peerConnectionId, iceCandidate, isRemote = false) {
    this._telemetry.debug({
      group: 'ice-candidate',
      name: 'ice-candidate',
      payload: {
        peerConnectionId,
        isRemote: isRemote ? 'true' : 'false',
        ...this._toIceCandidatePayload(iceCandidate)
      }
    });
  }

  /**
   * Emit a telemetry event when the selected ICE candidate pair changes
   * @param {string} peerConnectionId - The peer connection identifier
   * @param {RTCIceCandidatePair} pair - The selected candidate pair
   * @returns {void}
   */
  selectedCandidatePair(peerConnectionId, pair) {
    this._telemetry.debug({
      group: 'ice-candidate',
      name: 'selected-ice-candidate-pair',
      payload: filterObject({
        peerConnectionId,
        localCandidate: pair.local ? this._toIceCandidatePayload(pair.local) : null,
        remoteCandidate: pair.remote ? this._toIceCandidatePayload(pair.remote) : null
      }, null)
    });
  }

  /**
   * Convert RTCIceCandidate to telemetry payload format
   * @private
   * @param {RTCIceCandidate} iceCandidate - The RTCIceCandidate object
   * @returns {IceCandidatePayload} The telemetry payload format
   */
  _toIceCandidatePayload(iceCandidate) {
    const match = iceCandidate.candidate?.match(/network-cost\s+(\d+)/);
    const networkCost = match ? parseInt(match[1], 10) : null;

    return filterObject({
      'candidateType': iceCandidate.type,
      'ip': iceCandidate.address,
      'port': iceCandidate.port,
      'priority': iceCandidate.priority,
      'protocol': iceCandidate.protocol,
      'relatedAddress': iceCandidate.relatedAddress,
      'relatedPort': iceCandidate.relatedPort,
      'tcpType': iceCandidate.tcpType,
      'transportId': iceCandidate.sdpMid,
      'networkCost': networkCost
    }, null);
  }
}

module.exports = PeerConnectionEvents;
