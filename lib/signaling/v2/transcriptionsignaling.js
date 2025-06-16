'use strict';

const MediaSignaling = require('./mediasignaling');

/**
 * @emits TranscriptionSignaling#transcription
 */
class TranscriptionSignaling extends MediaSignaling {
  /**
   * Construct an {@link TranscriptionSignaling}.
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'extension_transcriptions', options);

    this.on('ready', transport => {
      transport.on('message', message => {
        switch (message.type) {
          case 'extension_transcriptions':
            this.emit('transcription', message);
            break;
          default:
            break;
        }
      });
    });
  }
}

/**
 * @event TranscriptionSignaling#transcription
 */

module.exports = TranscriptionSignaling;
