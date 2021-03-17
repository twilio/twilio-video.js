'use strict';

const RemoteParticipantSignaling = require('../remoteparticipant');
const RemoteTrackPublicationV2 = require('./remotetrackpublication');

/**
 * @extends RemoteParticipantSignaling
 * @property {?number} revision
 */
class RemoteParticipantV2 extends RemoteParticipantSignaling {
  /**
   * Construct a {@link RemoteParticipantV2}.
   * @param {object} participantState
   * @param {function(Track.SID): boolean} getInitialTrackSwitchOffState
   * @param {function(Track.SID, Track.Priority): boolean} setPriority
   * @param {function(Track.SID, ClientRenderHint): Promise<void>} setRenderHint
   * @param {function(Track.SID): void} clearTrackHint
   * @param {object} [options]
   */
  constructor(participantState, getInitialTrackSwitchOffState, setPriority, setRenderHint, clearTrackHint, options) {
    super(participantState.sid, participantState.identity);

    options = Object.assign({
      RemoteTrackPublicationV2
    }, options);

    Object.defineProperties(this, {
      _revision: {
        writable: true,
        value: null
      },
      _RemoteTrackPublicationV2: {
        value: options.RemoteTrackPublicationV2
      },
      _getInitialTrackSwitchOffState: {
        value: getInitialTrackSwitchOffState
      },
      updateSubscriberTrackPriority: {
        value: (trackSid, priority) => setPriority(trackSid, priority)
      },
      updateTrackRenderHint: {
        value: (trackSid, renderHint) => setRenderHint(trackSid, renderHint)
      },
      clearTrackHint: {
        value: trackSid => clearTrackHint(trackSid)
      },
      revision: {
        enumerable: true,
        get() {
          return this._revision;
        }
      }
    });

    return this.update(participantState);
  }

  /**
   * @private
   */
  _getOrCreateTrack(trackState) {
    const RemoteTrackPublicationV2 = this._RemoteTrackPublicationV2;
    let track = this.tracks.get(trackState.sid);
    if (!track) {
      const isSwitchedOff = this._getInitialTrackSwitchOffState(trackState.sid);
      track = new RemoteTrackPublicationV2(trackState, isSwitchedOff);
      this.addTrack(track);
    }
    return track;
  }

  /**
   * Update the {@link RemoteParticipantV2} with the new state.
   * @param {object} participantState
   * @returns {this}
   */
  update(participantState) {
    if (this.revision !== null && participantState.revision <= this.revision) {
      return this;
    }
    this._revision = participantState.revision;

    const tracksToKeep = new Set();

    participantState.tracks.forEach(trackState => {
      const track = this._getOrCreateTrack(trackState);
      track.update(trackState);
      tracksToKeep.add(track);
    });

    this.tracks.forEach(track => {
      if (!tracksToKeep.has(track)) {
        this.removeTrack(track);
      }
    });

    switch (participantState.state) {
      case 'disconnected':
        this.disconnect();
        break;
      case 'reconnecting':
        this.reconnecting();
        break;
      case 'connected':
        this.connect(this.sid, this.identity);
        break;
    }

    return this;
  }
}

module.exports = RemoteParticipantV2;
