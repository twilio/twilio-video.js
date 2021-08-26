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
      this._log.info('publisher_hints transport ready: ', transport);
      transport.on('message', message => {
        this._log.debug('publisher_hints Incoming: ', message);
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

  // {
  //   "publisher": {
  //     "hints": [
  //       {
  //         "encodings": [
  //           {
  //             "enabled": true,
  //             "layer_index": 0,
  //             "max_bitrate": 500000,
  //             "max_framerate": 5,
  //             "render_dimensions": {
  //               "height": 180,
  //               "width": 320
  //             }
  //           },
  //           {
  //             "enabled": false,
  //             "layer_index": 1
  //           }
  //         ],
  //         "track": "MT123"
  //       }
  //     ],
  //     "id": 123
  //   },
  //   "type": "publisher_hints"
  // }
  _processPublisherHints(hints, id) {
    const hintResponses = [];
    try {
      hints.forEach(hint => {
        hintResponses.push({
          track: hint.track,
          result: 'OK'
        });

        hint.encodings.forEach(({ enabled, layer_index: layerIndex }) => {
          this._log.debug(`${hint.track} layer:${layerIndex}, enabled:${enabled}`);
        });
      });
      this.emit('updated', hints);
    } catch (ex) {
      this._log.error('error processing hints:', ex);
    }
    // {
    //   "type": "publisher_hints",
    //   "publisher": {
    //     "hints": [
    //       {
    //         "track": "MT123",
    //         "result": "OK"
    //       },
    //       {
    //         "track": "MT456",
    //         "result": "INVALID_PUBLISHER_HINT"
    //       },
    //       {
    //         "track": "MT789",
    //         "result": "UNKNOWN_TRACK"
    //       }
    //     ],
    //     "id": 123
    //   }
    // }
    const payLoad = {
      type: 'publisher_hints',
      publisher: { id, hints }
    };
    this._transport.publish(payLoad);
  }
}


module.exports = PublisherHintsSignaling;
