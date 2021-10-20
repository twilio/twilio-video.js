/* eslint callback-return:0 */
'use strict';

const MediaSignaling = require('./mediasignaling');

class PublisherHintsSignaling extends MediaSignaling {
  /**
   * Construct a {@link RenderHintsSignaling}.
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'publisher_hints', options);
    this.on('ready', transport => {
      this._log.warn('publisher_hints transport ready:', transport);
      transport.on('message', message => {
        this._log.warn('Incoming: ', JSON.stringify(message));
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

  sendHintResponse({ id, hints }) {
    const payLoad = {
      type: 'publisher_hints',
      publisher: { id, hints }
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
