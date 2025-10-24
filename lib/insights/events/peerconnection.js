'use strict';

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
}

module.exports = PeerConnectionEvents;
