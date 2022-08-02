'use strict';

const RemoteParticipantV2 = require('../v2/remoteparticipant');
const RemoteTrackPublicationV3 = require('./remotetrackpublication');

/**
 * @extends RemoteParticipantV2
 */
class RemoteParticipantV3 extends RemoteParticipantV2 {
  /**
   * Construct a {@link RemoteParticipantV2}.
   * @param {object} participantState
   * @param {function(Track.SID): Promise<MediaTrackReceiver>} getPendingTrackReceiver
   * @param {function(Track.SID): boolean} getInitialTrackSwitchOffState
   * @param {function(Track.SID, Track.Priority): boolean} setPriority
   * @param {function(Track.SID, ClientRenderHint): Promise<void>} setRenderHint
   * @param {function(Track.SID): void} clearTrackHint
   * @param {function(MediaStreamTrack): Promise<Map<PeerConnectionV2#id, StandardizedTrackStatsReport>>} getTrackStats
   * @param {object} [options]
   */
  constructor(
    participantState,
    getPendingTrackReceiver,
    getInitialTrackSwitchOffState,
    setPriority,
    setRenderHint,
    clearTrackHint,
    getTrackStats,
    options
  ) {
    options = Object.assign({
      RemoteTrackPublicationSignaling: RemoteTrackPublicationV3,
      getPendingTrackReceiver,
      getTrackStats
    }, options);

    super(
      participantState,
      getInitialTrackSwitchOffState,
      setPriority,
      setRenderHint,
      clearTrackHint,
      options
    );
  }

  /**
   * @private
   */
  _getOrCreateTrack(trackState) {
    const {
      _RemoteTrackPublicationSignaling: RemoteTrackPublicationV3,
      _getPendingTrackReceiver: getPendingTrackReceiver,
      _getTrackStats: getTrackStats
    } = this;
    let track = this.tracks.get(trackState.sid);
    if (!track) {
      const { state, switchOffReason = null } = this.kind === 'data'
        ? { state: 'ON', switchOffReason: null }
        : this._getInitialTrackSwitchOffState(trackState.sid);
      track = new RemoteTrackPublicationV3(trackState, state === 'OFF', switchOffReason, getTrackStats);
      this.addTrack(track);

      getPendingTrackReceiver(track.sid).then(trackReceiver => {
        // NOTE(mmalavalli): DataTracks are subscribed to only if corresponding DataTrackReceivers
        // are available, whereas MediaTracks can be subscribed to irrespective of whether corresponding
        // MediaTrackReceivers are available. MediaTracks without MediaTrackReceivers are considered
        // switched off.
        track.setTrackTransceiver(trackReceiver, track.kind !== 'data' || !!trackReceiver);
      });
    }
    return track;
  }
}

module.exports = RemoteParticipantV3;
