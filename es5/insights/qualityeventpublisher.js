'use strict';
/**
 * @typedef {import('../../tsdef/types').LocalVideoTrackStats} LocalVideoTrackStats
 */
/**
 * @typedef {import('../../tsdef/index').Log.Logger} Log
 */
/**
 * QualityEventPublisher handles publishing quality information events to the Twilio Video SDK insights.
 *
 * @example
 * const qualityEventPublisher = new QualityEventPublisher(eventObserver, log);
 *
 * // Quality limitation reason changes are published in the following format:
 * {
 *   group: 'quality',
 *   name: 'quality-limitation-state-changed',
 *   level: 'info',
 *   payload: {
 *     trackSid: string, // Track Sid
 *     qualityLimitationReason: string // 'none', 'cpu', 'bandwidth', or 'other'
 *   }
 * }
 *
 * // Clean up when no longer needed
 * qualityEventPublisher.cleanup();
 */
var QualityEventPublisher = /** @class */ (function () {
    /**
     * Create a QualityEventPublisher
     * @param {EventObserver} eventObserver - The event observer for publishing insights
     * @param {Log} log - Logger instance
     */
    function QualityEventPublisher(eventObserver, log) {
        this._eventObserver = eventObserver;
        this._log = log;
        this._lastQualityLimitationReasonByTrackSid = new Map();
    }
    /**
     * Process local video track stats to detect quality limitation reason changes.
     * @param {LocalVideoTrackStats[]} localVideoTrackStats
     */
    QualityEventPublisher.prototype.processStats = function (localVideoTrackStats) {
        var _this = this;
        if (!Array.isArray(localVideoTrackStats)) {
            return;
        }
        localVideoTrackStats.forEach(function (_a) {
            var trackSid = _a.trackSid, qualityLimitationReason = _a.qualityLimitationReason;
            _this._maybePublish(trackSid, qualityLimitationReason);
        });
    };
    /**
     * Check and publish if quality limitation reason changed.
     * @private
     * @param {LocalVideoTrackStats['trackSid']} trackSid
     * @param {LocalVideoTrackStats['qualityLimitationReason']} qualityLimitationReason
     */
    QualityEventPublisher.prototype._maybePublish = function (trackSid, qualityLimitationReason) {
        if (!trackSid || typeof qualityLimitationReason !== 'string') {
            return;
        }
        var lastQualityLimitationReason = this._lastQualityLimitationReasonByTrackSid.get(trackSid);
        if (lastQualityLimitationReason !== qualityLimitationReason) {
            this._log.debug("Quality limitation reason changed for track " + trackSid + ": " + (lastQualityLimitationReason || 'none') + " -> " + qualityLimitationReason);
            this._lastQualityLimitationReasonByTrackSid.set(trackSid, qualityLimitationReason);
            this._publishQualityLimitationReasonChanged(trackSid, qualityLimitationReason);
        }
    };
    /**
     * Publish a quality limitation reason change event
     * @private
     * @param {string} trackSid - The Track SID
     * @param {string} qualityLimitationReason - The quality limitation reason
     */
    QualityEventPublisher.prototype._publishQualityLimitationReasonChanged = function (trackSid, qualityLimitationReason) {
        try {
            this._publishEvent('quality-limitation-state-changed', 'info', {
                trackSid: trackSid,
                qualityLimitationReason: qualityLimitationReason,
            });
        }
        catch (error) {
            this._log.error('Error publishing quality limitation reason change:', error);
        }
    };
    /**
     * Publish an event through the EventObserver.
     * @private
     * @param {string} name - Event name
     * @param {string} level - Event level (debug, info, warning, error)
     * @param {Object} payload - Event payload
     */
    QualityEventPublisher.prototype._publishEvent = function (name, level, payload) {
        try {
            this._eventObserver.emit('event', {
                group: 'quality',
                name: name,
                level: level,
                payload: payload,
            });
        }
        catch (error) {
            this._log.error("QualityEventPublisher: Error publishing event " + name + ":", error);
        }
    };
    /**
     * Cleanup all quality event monitoring
     */
    QualityEventPublisher.prototype.cleanup = function () {
        this._lastQualityLimitationReasonByTrackSid.clear();
    };
    return QualityEventPublisher;
}());
module.exports = QualityEventPublisher;
//# sourceMappingURL=qualityeventpublisher.js.map