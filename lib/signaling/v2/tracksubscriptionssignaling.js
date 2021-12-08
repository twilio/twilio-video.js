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
      log.debug('track_subscriptions transport ready');
      transport.on('message', message => {
        switch (message.type) {
          case 'track_subscriptions':
            // eslint-disable-next-line no-console
            console.log('Incoming track_subscriptions MSP message:', message.subscribed);
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
