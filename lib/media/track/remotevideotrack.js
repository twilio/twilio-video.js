'use strict';

const mixinRemoteMediaTrack = require('./remotemediatrack');
const VideoTrack = require('./videotrack');

const RemoteMediaVideoTrack = mixinRemoteMediaTrack(VideoTrack);

/**
 * A {@link RemoteVideoTrack} represents a {@link VideoTrack} published to a
 * {@link Room} by a {@link RemoteParticipant}.
 * @extends VideoTrack
 * @property {boolean} isEnabled - Whether the {@link RemoteVideoTrack} is enabled
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteVideoTrack} is switched off
 * @property {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteVideoTrack}
 * @emits RemoteVideoTrack#dimensionsChanged
 * @emits RemoteVideoTrack#disabled
 * @emits RemoteVideoTrack#enabled
 * @emits RemoteVideoTrack#started
 * @emits RemoteVideoTrack#switchedOff
 * @emits RemoteVideoTrack#switchedOn
 */
class RemoteVideoTrack extends RemoteMediaVideoTrack {
  /**
   * Construct a {@link RemoteVideoTrack}.
   * @param {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
   * @param {MediaTrackReceiver} mediaTrackReceiver - A video MediaStreamTrack container
   * @param {boolean} isEnabled - whether the {@link RemoteVideoTrack} is enabled
   * @param {boolean} isSwitchedOff - Whether the {@link RemoteVideoTrack} is switched off
   * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
   *  {@link Track.Priority} of the {@link RemoteVideoTrack}
   * @param {{log: Log}} options - The {@link RemoteTrack} options
   */
  constructor(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, options) {
    super(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, options);
  }

  /**
   * Add a {@link VideoProcessor} to allow for custom processing of video frames belonging to a VideoTrack.
   * When a Participant unpublishes and re-publishes a VideoTrack, a new RemoteVideoTrack is created and
   * any VideoProcessors attached to the previous RemoteVideoTrack would have to be re-added again.
   * Only Chrome supports this as of now. Calling this API from a non-supported browser will result in a log warning.
   * @param {VideoProcessor} processor - The {@link VideoProcessor} to use.
   * @returns {this}
   * @example
   * class GrayScaleProcessor {
   *   constructor(percentage) {
   *     this.outputFrame = new OffscreenCanvas(0, 0);
   *     this.percentage = percentage;
   *   }
   *   processFrame(inputFrame) {
   *     this.outputFrame.width = inputFrame.width;
   *     this.outputFrame.height = inputFrame.height;
   *
   *     const context = this.outputFrame.getContext('2d');
   *     context.filter = `grayscale(${this.percentage}%)`;
   *     context.drawImage(inputFrame, 0, 0, inputFrame.width, inputFrame.height);
   *     return this.outputFrame;
   *   }
   * }
   *
   * const grayscaleProcessor = new GrayScaleProcessor(100);
   *
   * Array.from(room.participants.values()).forEach(participant => {
   *   const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
   *   remoteVideoTrack.addProcessor(grayscaleProcessor);
   * });
   */
  addProcessor() {
    return super.addProcessor.apply(this, arguments);
  }

  /**
   * Remove the previously added {@link VideoProcessor} using `addProcessor` API.
   * @param {VideoProcessor} processor - The {@link VideoProcessor} to remove.
   * @returns {this}
   * @example
   * class GrayScaleProcessor {
   *   constructor(percentage) {
   *     this.outputFrame = new OffscreenCanvas(0, 0);
   *     this.percentage = percentage;
   *   }
   *   processFrame(inputFrame) {
   *     this.outputFrame.width = inputFrame.width;
   *     this.outputFrame.height = inputFrame.height;
   *
   *     const context = this.outputFrame.getContext('2d');
   *     context.filter = `grayscale(${this.percentage}%)`;
   *     context.drawImage(inputFrame, 0, 0, inputFrame.width, inputFrame.height);
   *     return this.outputFrame;
   *   }
   * }
   *
   * const grayscaleProcessor = new GrayScaleProcessor(100);
   *
   * Array.from(room.participants.values()).forEach(participant => {
   *   const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
   *   remoteVideoTrack.addProcessor(grayscaleProcessor);
   * });
   *
   * document.getElementById('remove-button').onclick = () => {
   *   Array.from(room.participants.values()).forEach(participant => {
   *     const remoteVideoTrack = Array.from(participant.videoTracks.values())[0].track;
   *     remoteVideoTrack.removeProcessor(grayscaleProcessor);
   *   });
   * }
   */
  removeProcessor() {
    return super.removeProcessor.apply(this, arguments);
  }

  toString() {
    return `[RemoteVideoTrack #${this._instanceId}: ${this.sid}]`;
  }

  /**
   * Update the subscribe {@link Track.Priority} of the {@link RemoteVideoTrack}.
   * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
   *   If <code>null</code>, then the subscribe {@link Track.Priority} is cleared, which
   *   means the {@link Track.Priority} set by the publisher is now the effective priority.
   * @returns {this}
   * @throws {RangeError}
   */
  setPriority(priority) {
    return super.setPriority(priority);
  }
}

/**
 * The {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose
 *   dimensions changed
 * @event RemoteVideoTrack#dimensionsChanged
 */

/**
 * The {@link RemoteVideoTrack} was disabled, i.e. "paused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   disabled
 * @event RemoteVideoTrack#disabled
 */

/**
 * The {@link RemoteVideoTrack} was enabled, i.e. "resumed".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   enabled
 * @event RemoteVideoTrack#enabled
 */

/**
 * The {@link RemoteVideoTrack} started. This means there is enough video data
 * to begin playback.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that started
 * @event RemoteVideoTrack#started
 */

/**
 * A {@link RemoteVideoTrack} was switched off.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   switched off
 * @event RemoteVideoTrack#switchedOff
 */

/**
 * A {@link RemoteVideoTrack} was switched on.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   switched on
 * @event RemoteVideoTrack#switchedOn
 */

module.exports = RemoteVideoTrack;
