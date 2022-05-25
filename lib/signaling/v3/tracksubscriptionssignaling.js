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
        value: null,
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

      // NOTE(mpatwardhan): we receive ready message every time
      // MSP channel is established. That means at startup and at every VMS-failover.
      if (this._currentRevision !== null) {
        log.warn('resetting current version after VMS failover', this._currentRevision);
        this._currentRevision = null;
      }
    });
  }

  /**
   * @private
   */
  _handleIncomingMessage(message) {
    const { _log: log, _currentRevision: currentRevision } = this;
    const { data = {}, errors = {}, media = {}, revision } = message;
    // TODO(mmalavalli): Remove this once SFU sends revision as integer instead of string.
    const revisionNumber = Number(revision);
    if (currentRevision !== null && currentRevision >= revisionNumber) {
      log.warn(`Ignoring incoming ${this.channel} message as ${currentRevision} (current revision) >= ${revision} (incoming revision)`);
      log.debug(`Ignored incoming ${this.channel} message:`, message);
      return;
    }
    log.debug(`Incoming ${this.channel} MSP message:`, message);
    this._currentRevision = revisionNumber;
    this.emit('updated', media, data, errors);
  }
}

module.exports = TrackSubscriptionsSignaling;
