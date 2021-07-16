'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

var _require2 = require('../../util/constants'),
    DEFAULT_VIDEO_PROCESSOR_STATS_INTERVAL_MS = _require2.DEFAULT_VIDEO_PROCESSOR_STATS_INTERVAL_MS;

/**
 * VideoProcessorEventObserver listens to {@link VideoProcessor} related events
 * and re-emits them as a generic event with some additional information.
 * @extends EventEmitter
 * @emits VideoProcessorEventObserver#event
 */


var VideoProcessorEventObserver = function (_EventEmitter) {
  _inherits(VideoProcessorEventObserver, _EventEmitter);

  /**
   * Constructor.
   * @param {Log} log
   */
  function VideoProcessorEventObserver(log) {
    _classCallCheck(this, VideoProcessorEventObserver);

    var _this = _possibleConstructorReturn(this, (VideoProcessorEventObserver.__proto__ || Object.getPrototypeOf(VideoProcessorEventObserver)).call(this));

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

    _this.on('stats', function () {
      return _this._maybeEmitStats();
    });
    return _this;
  }

  /**
   * @private
   */


  _createClass(VideoProcessorEventObserver, [{
    key: '_getEventData',
    value: function _getEventData() {
      if (!this._processorInfo) {
        return {};
      }

      var _processorInfo = this._processorInfo,
          processor = _processorInfo.processor,
          captureHeight = _processorInfo.captureHeight,
          captureWidth = _processorInfo.captureWidth,
          inputFrameRate = _processorInfo.inputFrameRate,
          isRemoteVideoTrack = _processorInfo.isRemoteVideoTrack;

      var data = { captureHeight: captureHeight, captureWidth: captureWidth, inputFrameRate: inputFrameRate, isRemoteVideoTrack: isRemoteVideoTrack };
      data.name = processor._name || 'VideoProcessor';

      ['assetsPath', 'blurFilterRadius', 'fitType', 'isSimdEnabled', 'maskBlurRadius', 'version'].forEach(function (prop) {
        var val = processor['_' + prop];
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
    }

    /**
     * Save stats every second. If a specific time interval has elapsed,
     * the stats event will be emitted
     * @private
     */

  }, {
    key: '_maybeEmitStats',
    value: function _maybeEmitStats() {
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
          averages[name] = (averages[name] * n + current[name]) / (n + 1);
        });
        return averages;
      }, {});

      Object.keys(averages).forEach(function (name) {
        averages[name] = parseFloat(averages[name].toFixed(2));
      });
      this._reemitEvent('stats', Object.assign({}, averages, this._getEventData()));
    }

    /**
     * @private
     */

  }, {
    key: '_reemitEvent',
    value: function _reemitEvent(name, data) {
      this._log.debug('VideoProcessor:' + name, data);
      this.emit('event', { name: name, data: data });
    }
  }]);

  return VideoProcessorEventObserver;
}(EventEmitter);

module.exports = VideoProcessorEventObserver;