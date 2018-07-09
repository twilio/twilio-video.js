'use strict';

/**
 * Indicate whether the {@link IceServerSource} succeeded or not.
 * @enum {string}
 */
// eslint-disable-next-line
const IceServerSourceStatus = {
  overrode: 'overrode',
  success: 'success',
  failure: 'failure'
};

/**
 * An implementation of {@link IceServerSource} can be used to provide ICE
 * servers when participating in {@link Room}s.
 * @interface IceServerSource
 * @extends {EventEmitter}
 *   servers, if any
 * @property {boolean} isStarted
 * @property {?IceServerSourceStatus} status
 * @emits IceServerSource#iceServers
 */

/**
 * This method will be called once before connecting to a {@link Room}. It
 * should cause the {@link IceServerSource} to start emitting ICE servers. This
 * method should also return the next set of ICE servers to be emitted.
 * @method IceServerSource#start
 * @returns {Promise<Array<RTCIceServerInit>>}
 */

/**
 * This method will be called once when disconnecting from a {@link Room} (or
 * in the event that connecting to a {@link Room} fails). It should cause the
 * {@link IceServerSource} to stop emitting ICE servers.
 * @method IceServerSource#stop
 * @returns {void}
 */

/**
 * An implementation of {@link IceServerSource} should emit
 * {@link IceServerSource#event:iceServers} whenever new ICE servers should be
 * used. This is useful, for example, if you are providing TURN servers that
 * require a credential which needs to be refreshed.
 * {@link IceServerSource#event:iceServers} typically triggers an ICE restart
 * for any RTCPeerConnections negotiated within a {@link Room}.
 * @event IceServerSource#iceServers
 * @param {Array<RTCIceServerInit>} iceServers - the new ICE servers
 */
