'use strict';

const MediaSignaling = require('./mediasignaling');

/**
 * @emits LiveTranscriptionSignaling#transcription
 */
class LiveTranscriptionSignaling extends MediaSignaling {
  /**
   * Construct an {@link LiveTranscriptionSignaling}.
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'extension_transcriptions', options);

    this.on('ready', transport => {
      transport.on('message', message => {
        switch (message.type) {
          case 'extension_transcriptions':
            // TODO: Test and update the message format once this is ready on the backend
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
 * @event LiveTranscriptionSignaling#transcription
 */

module.exports = LiveTranscriptionSignaling;
