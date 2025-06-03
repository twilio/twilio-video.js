'use strict';

const MediaSignaling = require('./mediasignaling');

/**
 * @emits LiveTranscriptionSignaling#transcription
 * @property {boolean} isEnabled - Whether the connection is live and ready to receive transcription events
 */
class LiveTranscriptionSignaling extends MediaSignaling {
  /**
   * Construct an {@link LiveTranscriptionSignaling}.
   */
  constructor(getReceiver, options) {
    super(getReceiver, 'extension_transcriptions', options);

    this.isEnabled = false;

    this.on('ready', transport => {
      this.isEnabled = true;

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

    this.on('teardown', () => {
      this.isEnabled = false;
    });
  }
}

/**
 * @event LiveTranscriptionSignaling#transcription
 */

module.exports = LiveTranscriptionSignaling;
