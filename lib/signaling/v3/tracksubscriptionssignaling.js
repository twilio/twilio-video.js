'use strict';

const MediaSignaling = require('../v2/mediasignaling');

class TrackSubscriptionsSignaling extends MediaSignaling {
  /**
   * Construct a {@link TrackSubscriptionsSignaling}.
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'track_subscriptions', options);

    Object.defineProperties(this, {
      _currentRevision: {
        value: 0,
        writable: true
      }
    });
    const { _log: log } = this;

    this.on('ready', transport => {
      log.debug(`${this.channel} transport ready`);
      transport.on('message', message => {
        switch (message.type) {
          case this.channel:
            this._handleIncomingMessage(message);
            break;
          default:
            log.warn(`Unknown ${this.channel} MSP message type:`, message.type);
            break;
        }
      });
    });
  }

  /**
   * @private
   */
  _handleIncomingMessage(message) {
    const { _log: log, _currentRevision: currentRevision } = this;
    const { errors = {}, revision, subscribed = {} } = message;

    if (currentRevision >= revision) {
      log.warn(`Ignoring incoming ${this.channel} message as ${currentRevision} (current revision) >= ${revision} (incoming revision)`);
      log.debug(`Ignored incoming ${this.channel} message:`, message);
      return;
    }
    log.debug(`Incoming ${this.channel} MSP message:`, message);
    this._currentRevision = revision;
    this.emit('updated', subscribed, errors);
  }
}

module.exports = TrackSubscriptionsSignaling;
