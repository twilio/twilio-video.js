'use strict';

const MediaSignaling = require('./mediasignaling');
class TrackPrioritySignaling extends MediaSignaling {
  /**
   * Construct a {@link TrackPrioritySignaling}.
   * @param {Promise<DataTrackReceiver>} getReceiver
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'track_priority', options);

    Object.defineProperties(this, {
      _enqueuedPriorityUpdates: {
        value: new Map()
      },
    });

    this.on('ready', transport => {
      Array.from(this._enqueuedPriorityUpdates.keys()).forEach(trackSid => {
        transport.publish({
          type: 'track_priority',
          track: trackSid,
          subscribe: this._enqueuedPriorityUpdates.get(trackSid)
        });
        // NOTE(mpatwardhan)- we do not clear _enqueuedPriorityUpdates intentionally,
        // this cache will is used to re-send the priorities in case of VMS-FailOver.
      });
    });
  }

  /**
   * @param {Track.SID} trackSid
   * @param {'publish'|'subscribe'} publishOrSubscribe
   * @param {Track.Priority} priority
   */
  sendTrackPriorityUpdate(trackSid, publishOrSubscribe, priority) {
    if (publishOrSubscribe !== 'subscribe') {
      throw new Error('only subscribe priorities are supported, found: ' + publishOrSubscribe);
    }
    this._enqueuedPriorityUpdates.set(trackSid, priority);
    if (this._transport) {
      this._transport.publish({
        type: 'track_priority',
        track: trackSid,
        subscribe: priority
      });
    }
  }
}

module.exports = TrackPrioritySignaling;
