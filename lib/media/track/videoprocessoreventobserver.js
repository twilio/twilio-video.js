'use strict';

const { EventEmitter } = require('events');
const { DEFAULT_VIDEO_PROCESSOR_STATS_INTERVAL_MS } = require('../../util/constants');

/**
 * VideoProcessorEventObserver listens to {@link VideoProcessor} related events
 * and re-emits them as a generic event with some additional information.
 * @extends EventEmitter
 * @emits VideoProcessorEventObserver#event
 */
class VideoProcessorEventObserver extends EventEmitter {

  /**
   * Constructor.
   * @param {Log} log
   */
  constructor(log) {
    super();

    Object.defineProperties(this, {
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

    this.on('add', info => {
      this._lastStatsSaveTime = Date.now();
      this._lastStatsPublishTime = Date.now();
      this._processorInfo = info;
      this._stats = [];
      this._reemitEvent('add', this._getEventData());
    });

    this.on('remove', () => {
      const data = this._getEventData();
      this._lastStatsSaveTime = null;
      this._lastStatsPublishTime = null;
      this._processorInfo = null;
      this._stats = null;
      this._reemitEvent('remove', data);
    });

    this.on('start', () => {
      this._reemitEvent('start', this._getEventData());
    });

    this.on('stop', message => {
      this._reemitEvent('stop', Object.assign({ message }, this._getEventData()));
    });

    this.on('stats', () => this._maybeEmitStats());
  }

  /**
   * @private
   */
  _getEventData() {
    if (!this._processorInfo) {
      return {};
    }

    const {
      processor,
      captureHeight,
      captureWidth,
      inputFrameRate,
      isRemoteVideoTrack,
      inputFrameBufferType,
      outputFrameBufferContextType
    } = this._processorInfo;
    const data = { captureHeight, captureWidth, inputFrameRate, isRemoteVideoTrack, inputFrameBufferType, outputFrameBufferContextType };
    data.name = processor._name || 'VideoProcessor';

    ['assetsPath', 'blurFilterRadius', 'debounce', 'fitType', 'isSimdEnabled', 'maskBlurRadius', 'pipeline', 'version'].forEach(prop => {
      const val = processor[`_${prop}`];
      if (typeof val !== 'undefined') {
        data[prop] = val;
      }
    });

    Object.keys(data).forEach(prop => {
      const val = data[prop];
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
  _maybeEmitStats() {
    if (!this._stats || !this._processorInfo) {
      return;
    }
    const benchmark = this._processorInfo.processor._benchmark;
    if (!benchmark) {
      return;
    }
    const now = Date.now();
    if (now - this._lastStatsSaveTime < 1000) {
      return;
    }

    const entry = { outputFrameRate: benchmark.getRate('totalProcessingDelay') };
    ['captureFrameDelay', 'imageCompositionDelay', 'inputImageResizeDelay', 'processFrameDelay', 'segmentationDelay'].forEach(name => {
      entry[name] = benchmark.getAverageDelay(name);
    });
    this._lastStatsSaveTime = now;
    this._stats.push(entry);

    if (now - this._lastStatsPublishTime < DEFAULT_VIDEO_PROCESSOR_STATS_INTERVAL_MS) {
      return;
    }
    this._lastStatsPublishTime = now;
    const stats = this._stats.splice(0);
    const averages = stats.reduce((averages, current, n) => {
      Object.keys(entry).forEach(name => {
        if (!averages[name]) {
          averages[name] = 0;
        }
        averages[name] = ((averages[name] * n) + current[name]) / (n + 1);
      });
      return averages;
    }, {});

    Object.keys(averages).forEach(name => {
      averages[name] = parseFloat(averages[name].toFixed(2));
    });
    this._reemitEvent('stats', Object.assign({}, averages, this._getEventData()));
  }

  /**
   * @private
   */
  _reemitEvent(name, data) {
    this._log.debug(`VideoProcessor:${name}`, data);
    this.emit('event', { name, data });
  }
}

module.exports = VideoProcessorEventObserver;
