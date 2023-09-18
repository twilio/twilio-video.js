'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var EventEmitter = require('events').EventEmitter;
var DEFAULT_VIDEO_PROCESSOR_STATS_INTERVAL_MS = require('../../util/constants').DEFAULT_VIDEO_PROCESSOR_STATS_INTERVAL_MS;
/**
 * VideoProcessorEventObserver listens to {@link VideoProcessor} related events
 * and re-emits them as a generic event with some additional information.
 * @extends EventEmitter
 * @emits VideoProcessorEventObserver#event
 */
var VideoProcessorEventObserver = /** @class */ (function (_super) {
    __extends(VideoProcessorEventObserver, _super);
    /**
     * Constructor.
     * @param {Log} log
     */
    function VideoProcessorEventObserver(log) {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _lastStatsSaveTime: {
                value: null,
                writable: true
            },
            _lastStatsPublishTime: {
                value: null,
                writable: true
            },
            _log: {
                value: log
            },
            _processorInfo: {
                value: null,
                writable: true
            },
            _stats: {
                value: null,
                writable: true
            }
        });
        _this.on('add', function (info) {
            _this._lastStatsSaveTime = Date.now();
            _this._lastStatsPublishTime = Date.now();
            _this._processorInfo = info;
            _this._stats = [];
            _this._reemitEvent('add', _this._getEventData());
        });
        _this.on('remove', function () {
            var data = _this._getEventData();
            _this._lastStatsSaveTime = null;
            _this._lastStatsPublishTime = null;
            _this._processorInfo = null;
            _this._stats = null;
            _this._reemitEvent('remove', data);
        });
        _this.on('start', function () {
            _this._reemitEvent('start', _this._getEventData());
        });
        _this.on('stop', function (message) {
            _this._reemitEvent('stop', Object.assign({ message: message }, _this._getEventData()));
        });
        _this.on('stats', function () { return _this._maybeEmitStats(); });
        return _this;
    }
    /**
     * @private
     */
    VideoProcessorEventObserver.prototype._getEventData = function () {
        if (!this._processorInfo) {
            return {};
        }
        var _a = this._processorInfo, processor = _a.processor, captureHeight = _a.captureHeight, captureWidth = _a.captureWidth, inputFrameRate = _a.inputFrameRate, isRemoteVideoTrack = _a.isRemoteVideoTrack, inputFrameBufferType = _a.inputFrameBufferType, outputFrameBufferContextType = _a.outputFrameBufferContextType;
        var data = { captureHeight: captureHeight, captureWidth: captureWidth, inputFrameRate: inputFrameRate, isRemoteVideoTrack: isRemoteVideoTrack, inputFrameBufferType: inputFrameBufferType, outputFrameBufferContextType: outputFrameBufferContextType };
        data.name = processor._name || 'VideoProcessor';
        ['assetsPath', 'blurFilterRadius', 'debounce', 'fitType', 'isSimdEnabled', 'maskBlurRadius', 'pipeline', 'version'].forEach(function (prop) {
            var val = processor["_" + prop];
            if (typeof val !== 'undefined') {
                data[prop] = val;
            }
        });
        Object.keys(data).forEach(function (prop) {
            var val = data[prop];
            if (typeof val === 'boolean') {
                data[prop] = val ? 'true' : 'false';
            }
        });
        return data;
    };
    /**
     * Save stats every second. If a specific time interval has elapsed,
     * the stats event will be emitted
     * @private
     */
    VideoProcessorEventObserver.prototype._maybeEmitStats = function () {
        if (!this._stats || !this._processorInfo) {
            return;
        }
        var benchmark = this._processorInfo.processor._benchmark;
        if (!benchmark) {
            return;
        }
        var now = Date.now();
        if (now - this._lastStatsSaveTime < 1000) {
            return;
        }
        var entry = { outputFrameRate: benchmark.getRate('totalProcessingDelay') };
        ['captureFrameDelay', 'imageCompositionDelay', 'inputImageResizeDelay', 'processFrameDelay', 'segmentationDelay'].forEach(function (name) {
            entry[name] = benchmark.getAverageDelay(name);
        });
        this._lastStatsSaveTime = now;
        this._stats.push(entry);
        if (now - this._lastStatsPublishTime < DEFAULT_VIDEO_PROCESSOR_STATS_INTERVAL_MS) {
            return;
        }
        this._lastStatsPublishTime = now;
        var stats = this._stats.splice(0);
        var averages = stats.reduce(function (averages, current, n) {
            Object.keys(entry).forEach(function (name) {
                if (!averages[name]) {
                    averages[name] = 0;
                }
                averages[name] = ((averages[name] * n) + current[name]) / (n + 1);
            });
            return averages;
        }, {});
        Object.keys(averages).forEach(function (name) {
            averages[name] = parseFloat(averages[name].toFixed(2));
        });
        this._reemitEvent('stats', Object.assign({}, averages, this._getEventData()));
    };
    /**
     * @private
     */
    VideoProcessorEventObserver.prototype._reemitEvent = function (name, data) {
        this._log.debug("VideoProcessor:" + name, data);
        this.emit('event', { name: name, data: data });
    };
    return VideoProcessorEventObserver;
}(EventEmitter));
module.exports = VideoProcessorEventObserver;
//# sourceMappingURL=videoprocessoreventobserver.js.map