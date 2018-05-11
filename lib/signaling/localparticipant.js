'use strict';

const ParticipantSignaling = require('./participant');

class LocalParticipantSignaling extends ParticipantSignaling {
  constructor() {
    super();
    Object.defineProperties(this, {
      _trackSendersToPublications: {
        value: new Map()
      }
    });
  }

  /**
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @returns {LocalTrackPublicationSignaling} publication
   */
  addTrack(trackSender, name) {
    const publication = this._createLocalTrackPublicationSignaling(trackSender, name);
    this._trackSendersToPublications.set(trackSender, publication);
    super.addTrack(publication);
    return this;
  }

  /**
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @returns {?LocalTrackPublicationSignaling}
   */
  getPublication(trackSender) {
    return this._trackSendersToPublications.get(trackSender) || null;
  }

  /**
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @returns {?LocalTrackPublicationSignaling}
   */
  removeTrack(trackSender) {
    const publication = this._trackSendersToPublications.get(trackSender);
    if (!publication) {
      return null;
    }
    this._trackSendersToPublications.delete(trackSender);
    const didDelete = super.removeTrack(publication);
    if (didDelete) {
      // NOTE(mroberts): Only stop MediaTrackSenders.
      if (trackSender.stop) {
        trackSender.stop();
      }
    }
    return publication;
  }
}

module.exports = LocalParticipantSignaling;
