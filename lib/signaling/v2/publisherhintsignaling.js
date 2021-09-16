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
      this._log.info('publisher_hints transport ready:', transport);
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

  /**
   * @private
   */
  _processPublisherHints(hints, id) {
    const hintResponses = [];
    try {
      hints.forEach(hint => {
        hintResponses.push({
          track: hint.track,
          result: 'OK'
        });
      });
      this.emit('updated', hints);
    } catch (ex) {
      this._log.error('error processing hints:', ex);
    }
    const payLoad = {
      type: 'publisher_hints',
      publisher: { id, hints: hintResponses }
    };
    this._log.debug('Outgoing: ', payLoad);
    this._transport.publish(payLoad);
  }
}


module.exports = PublisherHintsSignaling;
