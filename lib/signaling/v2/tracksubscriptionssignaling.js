'use strict';

const MediaSignaling = require('./mediasignaling');

class TrackSubscriptionsSignaling extends MediaSignaling {
  /**
   * Construct an {@link DominantSpeakerSignaling}.
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'track_subscriptions', options);

    const log = this._log;

    this.on('ready', transport => {
      transport.on('message', message => {
        log.debug('track_subscriptions transport ready');
        switch (message.type) {
          case 'track_subscriptions':
            log.debug('Incoming track_subscriptions MSP message:', message);
            break;
          default:
            log.warn('Unknown track_subscriptions MSP message type:', message.type);
            break;
        }
      });
    });
  }
}

module.exports = TrackSubscriptionsSignaling;
