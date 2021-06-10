'use strict';

const assert = require('assert');
const sinon = require('sinon');
const log = require('../../../../lib/fakelog');
const VideoProcessorEventObserver = require('../../../../../lib/media/track/videoprocessoreventobserver');

describe('VideoProcessorEventObserver', () => {
  let processor;
  let captureInfo;
  let processorInfo;
  let eventData;
  let observer;
  let listener;
  let clock;

  const getBenchmark = dummyValue => ({
    getRate: () => dummyValue,
    getAverageDelay: () => dummyValue
  });

  beforeEach(() => {
    processor = {
      _assetsPath: '/virtualbackground/',
      _blurFilterRadius: 15,
      _fitType: 'Cover',
      _isSimdEnabled: true,
      _maskBlurRadius: 5,
      _name: 'VirtualBackgroundProcessor',
      _version: '1.0.0',
      _benchmark: getBenchmark(1)
    };

    captureInfo = {
      captureHeight: 720,
      captureWidth: 1280,
      inputFrameRate: 24,
      isRemoteVideoTrack: false
    };

    processorInfo = Object.assign({ processor }, captureInfo);

    eventData = {
      assetsPath: processor._assetsPath,
      blurFilterRadius: processor._blurFilterRadius,
      captureHeight: captureInfo.captureHeight,
      captureWidth: captureInfo.captureWidth,
      fitType: processor._fitType,
      inputFrameRate: captureInfo.inputFrameRate,
      isRemoteVideoTrack: captureInfo.isRemoteVideoTrack.toString(),
      isSimdEnabled: processor._isSimdEnabled.toString(),
      maskBlurRadius: processor._maskBlurRadius,
      name: processor._name,
      version: processor._version
    };

    listener = sinon.stub();
    observer = new VideoProcessorEventObserver(log);
    observer.on('event', listener);
  });

  it('should set internal properties to correct values', () => {
    assert(!observer._lastStatsSaveTime);
    assert(!observer._lastStatsPublishTime);
    assert(!observer._processorInfo);
    assert(!observer._stats);
    assert.deepStrictEqual(observer._log, log);
  });

  describe('add event', () => {
    beforeEach(() => {
      observer.emit('add', processorInfo);
    });

    it('should init internal props', () => {
      assert(!!observer._lastStatsSaveTime);
      assert(!!observer._lastStatsPublishTime);
      assert(!!observer._processorInfo);
      assert(!!observer._stats);
      assert.deepStrictEqual(observer._stats.length, 0);
      assert.deepStrictEqual(observer._processorInfo, processorInfo);
    });

    it('should reemit the event with additional information', () => {
      sinon.assert.calledOnce(listener);
      sinon.assert.calledWithExactly(listener, { name: 'add', data: eventData });
    });
  });

  describe('remove event', () => {
    beforeEach(() => {
      observer.emit('add', processorInfo);
      observer.emit('remove');
    });

    it('should reset internal props', () => {
      assert(!observer._lastStatsSaveTime);
      assert(!observer._lastStatsPublishTime);
      assert(!observer._processorInfo);
      assert(!observer._stats);
    });

    it('should reemit the event with additional information', () => {
      sinon.assert.calledTwice(listener);
      sinon.assert.calledWithExactly(listener, { name: 'remove', data: eventData });
    });
  });

  describe('start event', () => {
    beforeEach(() => {
      observer.emit('add', processorInfo);
      observer.emit('start');
    });

    it('should reemit the event with additional information', () => {
      sinon.assert.calledTwice(listener);
      sinon.assert.calledWithExactly(listener, { name: 'start', data: eventData });
    });
  });

  describe('stop event', () => {
    beforeEach(() => {
      observer.emit('add', processorInfo);
      observer.emit('stop', 'foo');
    });

    it('should reemit the event with additional information', () => {
      sinon.assert.calledTwice(listener);
      sinon.assert.calledWithExactly(listener, { name: 'stop', data: Object.assign({ message: 'foo' }, eventData) });
    });
  });

  describe('stats event', () => {
    beforeEach(() => {
      clock = sinon.useFakeTimers();
      observer.emit('add', processorInfo);
    });

    afterEach(() => {
      clock.restore();
    });

    it('should not save an entry if stats is null', () => {
      observer._stats = null;
      clock.tick(1000);
      observer.emit('stats');
      assert(!observer._stats);
    });

    it('should not save an entry if processorInfo is null', () => {
      observer._processorInfo = null;
      clock.tick(1000);
      observer.emit('stats');
      assert.strictEqual(observer._stats.length, 0);
    });

    it('should not save an entry if benchmark is null', () => {
      observer._processorInfo.processor._benchmark = null;
      clock.tick(1000);
      observer.emit('stats');
      assert.strictEqual(observer._stats.length, 0);
    });

    it('should not save an entry before 1 second', () => {
      assert.strictEqual(observer._stats.length, 0);
      clock.tick(999);
      observer.emit('stats');
      assert.strictEqual(observer._stats.length, 0);
    });

    it('should save an entry after 1 second', () => {
      assert.strictEqual(observer._stats.length, 0);
      clock.tick(1000);
      observer.emit('stats');
      assert.strictEqual(observer._stats.length, 1);
    });

    it('should save an entry every 1 second only', () => {
      assert.strictEqual(observer._stats.length, 0);
      clock.tick(1000);
      observer.emit('stats');
      assert.strictEqual(observer._stats.length, 1);
      clock.tick(999);
      observer.emit('stats');
      assert.strictEqual(observer._stats.length, 1);
      clock.tick(1);
      observer.emit('stats');
      assert.strictEqual(observer._stats.length, 2);
    });

    it('should not re-emit event before 10 seconds', () => {
      sinon.assert.calledOnce(listener);
      clock.tick(9999);
      observer.emit('stats');
      sinon.assert.calledOnce(listener);
    });

    it('should re-emit event after 10 seconds', () => {
      sinon.assert.calledOnce(listener);
      clock.tick(10000);
      observer.emit('stats');
      sinon.assert.calledTwice(listener);
    });

    it('should re-emit event every 10 seconds only', () => {
      sinon.assert.calledOnce(listener);
      clock.tick(10000);
      observer.emit('stats');
      sinon.assert.calledTwice(listener);
      clock.tick(9999);
      observer.emit('stats');
      sinon.assert.calledTwice(listener);
      clock.tick(1000);
      observer.emit('stats');
      sinon.assert.calledThrice(listener);
    });

    it('should re-emit event with average values', () => {
      processor._benchmark = getBenchmark(1);
      clock.tick(1000);
      observer.emit('stats');
      processor._benchmark = getBenchmark(2);
      clock.tick(1000);
      observer.emit('stats');
      processor._benchmark = getBenchmark(3);
      clock.tick(1000);
      observer.emit('stats');
      processor._benchmark = getBenchmark(4);
      clock.tick(1000);
      observer.emit('stats');
      clock.tick(10000);
      processor._benchmark = getBenchmark(5);
      observer.emit('stats');
      sinon.assert.calledWithExactly(listener, { name: 'stats', data: Object.assign({
        captureFrameDelay: 3,
        imageCompositionDelay: 3,
        inputImageResizeDelay: 3,
        outputFrameRate: 3,
        processFrameDelay: 3,
        segmentationDelay: 3,
      }, eventData) });
    });
  });

  describe('event data', () => {
    it('should have correct data for custom processor', () => {
      observer.emit('add', Object.assign({ processor: {} }, captureInfo));
      const { captureHeight, captureWidth, inputFrameRate, isRemoteVideoTrack } = eventData;
      const expected = { name: 'VideoProcessor', captureHeight, captureWidth, inputFrameRate, isRemoteVideoTrack };
      sinon.assert.calledOnce(listener);
      sinon.assert.calledWithExactly(listener, { name: 'add', data: expected });
    });

    it('should have correct data for blur background processor', () => {
      delete processor._fitType;
      delete eventData.fitType;
      observer.emit('add', Object.assign({ processor }, captureInfo));
      sinon.assert.calledOnce(listener);
      sinon.assert.calledWithExactly(listener, { name: 'add', data: eventData });
    });

    it('should have correct data for virtual background processor', () => {
      delete processor._blurFilterRadius;
      delete eventData.blurFilterRadius;
      observer.emit('add', Object.assign({ processor }, captureInfo));
      sinon.assert.calledOnce(listener);
      sinon.assert.calledWithExactly(listener, { name: 'add', data: eventData });
    });

    it('should have correct data if simd is null', () => {
      delete processor._isSimdEnabled;
      delete eventData.isSimdEnabled;
      observer.emit('add', Object.assign({ processor }, captureInfo));
      sinon.assert.calledOnce(listener);
      sinon.assert.calledWithExactly(listener, { name: 'add', data: eventData });
    });
  });
});
