'use strict';

/**
 * {@link TwilioWarning} represents a warning encountered when
 * interacting with one of Twilio's services.
 * @enum {string}
 */
// eslint-disable-next-line
const TwilioWarning = {
  /**
   * Raised when the media server has not detected any media on the published
   * track that is being recorded in the past 30 seconds.
   * This warning is raised by {@link LocalTrackPublication}, {@link LocalParticipant},
   * and {@link Room} object.
   */
  recordingMediaLost: 'recordingMediaLost'
};

module.exports = TwilioWarning;
