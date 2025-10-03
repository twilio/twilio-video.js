'use strict';
/**
 * @typedef {import('../../tsdef/index').Log.Logger} Log
 */
/**
 * TrackWarningPublisher handles publishing track warning events to the Twilio Video SDK insights.
 * It monitors video track frame rates from WebRTC stats to detect stalled tracks.
 *
 * @example
 * const trackWarningPublisher = new TrackWarningPublisher(eventObserver, log);
 * trackWarningPublisher.processStats(remoteVideoTrackStats);
 *
 * // Track warning events for stalled tracks are published in the following format:
 * {
 *   group: 'track-warning-raised',
 *   name: 'track-stalled',
 *   level: 'warning',
 *   payload: {
 *     trackSid: string, // Track Sid
 *     frameRate: number, // Current frame rate
 *     threshold: number // Frame rate threshold
 *   }
 * }
 *
 * // Track warning cleared events for resumed tracks are published in the following format:
 *
 * {
 *   group: 'track-warning-cleared',
 *   name: 'track-stalled',
 *   level: 'info',
 *   payload: {
 *     trackSid: string, // Track Sid
 *     frameRate: number, // Current frame rate
 *     threshold: number // Frame rate threshold
 *   }
 * }
 *
 * // Clean up when no longer needed
 * trackWarningPublisher.cleanup();
 */
var TrackWarningPublisher = /** @class */ (function () {
    /**
     * Create a TrackWarningPublisher
     * @param {EventObserver} eventObserver - The event observer for publishing insights
     * @param {Log} log - Logger instance
     */
    function TrackWarningPublisher(eventObserver, log) {
        this._eventObserver = eventObserver;
        this._log = log;
        this._stalledTrackSids = new Set();
        // NOTE(lrivas): These thresholds can be made configurable in the future if needed
        // Nevertheless, a large gap is recommended to ensure tracks don't rapidly switch between states due to minor fluctuation
        this._stallThreshold = 0.5; // Frame rate below this is considered stalled
        this._resumeThreshold = 5; // Frame rate equal or above this is considered resumed
    }
    /**
     * Process remote video track stats to detect stalled tracks and resumptions.
     * @param {Array<{trackSid: string, frameRateReceived?: number}>} remoteVideoTrackStats
     */
    TrackWarningPublisher.prototype.processStats = function (remoteVideoTrackStats) {
        var _this = this;
        if (!Array.isArray(remoteVideoTrackStats)) {
            return;
        }
        remoteVideoTrackStats.forEach(function (_a) {
            var trackSid = _a.trackSid, frameRateReceived = _a.frameRateReceived;
            if (trackSid && typeof frameRateReceived === 'number') {
                _this._processTrackFrameRate(trackSid, frameRateReceived);
            }
        });
    };
    /**
     * Process track frame rate to detect stalls and resumptions
     * @private
     * @param {string} trackSid - The track Sid
     * @param {number} frameRate - Current frame rate
     */
    TrackWarningPublisher.prototype._processTrackFrameRate = function (trackSid, frameRate) {
        var isStalled = this._stalledTrackSids.has(trackSid);
        if (!isStalled && frameRate < this._stallThreshold) {
            this._stalledTrackSids.add(trackSid);
            this._publishTrackStalled(trackSid, frameRate);
        }
        else if (isStalled && frameRate >= this._resumeThreshold) {
            this._stalledTrackSids.delete(trackSid);
            this._publishTrackResumed(trackSid, frameRate);
        }
    };
    /**
     * Publish a track stalled event
     * @private
     * @param {string} trackSid - The Track Sid
     * @param {number} frameRate - Current frame rate
     */
    TrackWarningPublisher.prototype._publishTrackStalled = function (trackSid, frameRate) {
        var threshold = this._stallThreshold;
        this._log.debug("Track " + trackSid + " stalled: frame rate " + frameRate + " below threshold " + threshold);
        this._publishEvent('track-warning-raised', 'track-stalled', 'warning', {
            trackSid: trackSid,
            frameRate: frameRate,
            threshold: threshold,
            trackType: 'video',
        });
    };
    /**
     * Publish a track resumed event
     * @private
     * @param {string} trackSid - The Track Sid
     * @param {number} frameRate - Current frame rate
     */
    TrackWarningPublisher.prototype._publishTrackResumed = function (trackSid, frameRate) {
        var threshold = this._resumeThreshold;
        this._log.debug("Track " + trackSid + " resumed: frame rate " + frameRate + " above threshold " + threshold);
        this._publishEvent('track-warning-cleared', 'track-stalled', 'info', {
            trackSid: trackSid,
            frameRate: frameRate,
            threshold: threshold,
            trackType: 'video',
        });
    };
    /**
     * Publish an event through the EventObserver.
     * @private
     * @param {string} group - Event group
     * @param {string} name - Event name
     * @param {string} level - Event level (debug, info, warning, error)
     * @param {Object} payload - Event payload
    */
    TrackWarningPublisher.prototype._publishEvent = function (group, name, level, payload) {
        try {
            this._eventObserver.emit('event', {
                group: group,
                name: name,
                level: level,
                payload: payload,
            });
        }
        catch (error) {
            this._log.error("TrackWarningPublisher: Error publishing event " + name + ":", error);
        }
    };
    /**
     * Cleanup all track warning monitoring
     */
    TrackWarningPublisher.prototype.cleanup = function () {
        this._stalledTrackSids.clear();
    };
    return TrackWarningPublisher;
}());
module.exports = TrackWarningPublisher;
//# sourceMappingURL=trackwarningpublisher.js.map