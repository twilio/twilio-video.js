/* eslint callback-return:0 */
'use strict';

const MediaSignaling = require('./mediasignaling');

let messageId = 1;
class PublisherHintsSignaling extends MediaSignaling {
  /**
   * Construct a {@link RenderHintsSignaling}.
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'publisher_hints', options);
    this.on('ready', transport => {
      this._log.debug('publisher_hints transport ready:', transport);
      transport.on('message', message => {
        this._log.debug('Incoming: ', message);
        switch (message.type) {
          case 'publisher_hints':
            if (message.publisher && message.publisher.hints && message.publisher.id) {
              this._processPublisherHints(message.publisher.hints, message.publisher.id);
            }
            break;
          default:
            this._log.warn('Unknown message type: ', message.type);
            break;
        }
      });
    });
  }

  sendTrackReplaced({ trackSid }) {
    if (!this._transport) {
      return;
    }

    const payLoad = {
      type: 'client_reset',
      track: trackSid,
      id: messageId++
    };
    this._log.debug('Outgoing: ', payLoad);
    this._transport.publish(payLoad);
  }

  sendHintResponse({ id, hints }) {
    if (!this._transport) {
      return;
    }
    const payLoad = {
      type: 'publisher_hints',
      id,
      hints
    };
    this._log.debug('Outgoing: ', payLoad);
    this._transport.publish(payLoad);
  }

  /**
   * @private
   */
  _processPublisherHints(hints, id) {
    try {
      this.emit('updated', hints, id);
    } catch (ex) {
      this._log.error('error processing hints:', ex);
    }
  }
}


module.exports = PublisherHintsSignaling;
