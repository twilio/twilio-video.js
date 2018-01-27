'use strict';

const RemoteParticipantSignaling = require('../remoteparticipant');
const RemoteTrackV2 = require('./remotetrack');

/**
 * Construct a {@link RemoteParticipantV2}.
 * @class
 * @extends RemoteParticipantSignaling
 * @param {object} participantState
 * @param {function(string): Promise<DataTrackReceiver|MediaTrackReceiver>} getTrackReceiver
 * @param {object} [options]
 * @property {?number} revision
 */
class RemoteParticipantV2 extends RemoteParticipantSignaling {
  constructor(participantState, getTrackReceiver, options) {
    super(participantState.sid, participantState.identity);

    options = Object.assign({
      RemoteTrackV2
    }, options);

    Object.defineProperties(this, {
      _revision: {
        writable: true,
        value: null
      },
      _RemoteTrackV2: {
        value: options.RemoteTrackV2
      },
      _getTrackReceiver: {
        value: getTrackReceiver
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

  _getOrCreateTrack(trackState) {
    const RemoteTrackV2 = this._RemoteTrackV2;
    let track = this.tracks.get(trackState.id);
    if (!track) {
      track = new RemoteTrackV2(trackState);
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

    participantState.tracks.forEach(function(trackState) {
      const track = this._getOrCreateTrack(trackState);
      track.update(trackState);
      tracksToKeep.add(track);
    }, this);

    this.tracks.forEach(function(track) {
      if (!tracksToKeep.has(track)) {
        this.removeTrack(track);
      }
    }, this);

    if (participantState.state === 'disconnected' && this.state === 'connected') {
      this.preempt('disconnected');
    }

    return this;
  }

  /**
   * Add the {@link RemoteTrackV2} to the {@link RemoteParticipantV2}.
   * @param {RemoteTrackV2} track
   * @returns {this}
   */
  addTrack(track) {
    super.addTrack(track);
    this._getTrackReceiver(track.id).then(track.setTrackTransceiver.bind(track));
    return this;
  }
}

module.exports = RemoteParticipantV2;
