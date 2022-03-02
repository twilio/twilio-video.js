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
   * @param {object} [options]
   */
  constructor(
    participantState,
    getPendingTrackReceiver,
    getInitialTrackSwitchOffState,
    setPriority,
    setRenderHint,
    clearTrackHint,
    options
  ) {
    options = Object.assign({
      RemoteTrackPublicationSignaling: RemoteTrackPublicationV3,
      otherProperties: {
        _getPendingTrackReceiver: getPendingTrackReceiver
      }
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
      _getPendingTrackReceiver: getPendingTrackReceiver
    } = this;

    let track = this.tracks.get(trackState.sid);
    if (!track) {
      const { state, switchOffReason } = this._getInitialTrackSwitchOffState(trackState.sid);
      track = new RemoteTrackPublicationV3(trackState, state === 'OFF', switchOffReason);
      this.addTrack(track);
      getPendingTrackReceiver(track.sid).then(trackReceiver => track.setTrackTransceiver(trackReceiver, true));
    }
    return track;
  }
}

module.exports = RemoteParticipantV3;
