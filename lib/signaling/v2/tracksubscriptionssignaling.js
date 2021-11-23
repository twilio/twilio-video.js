'use strict';

const MediaSignaling = require('./mediasignaling');

class TrackSubscriptionsSignaling extends MediaSignaling {
  /**
   * Construct an {@link TrackSubscriptionsSignaling}.
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
            this.emit('updated', message.subscribed);
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
