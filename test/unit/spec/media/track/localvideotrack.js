'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mock = require('mock-require');
const log = require('../../../../lib/fakelog');
const { FakeMediaStreamTrack: MediaStreamTrack } = require('../../../../lib/fakemediastream');

describe('LocalVideoTrack', () => {
  const parentClassContext = {};
  let localVideoTrack;
  let mediaStreamTrack;
  let LocalVideoTrack;

  before(() => {
    delete require.cache[require.resolve('../../../../../lib/media/track/localmediatrack')];
    delete require.cache[require.resolve('../../../../../lib/media/track/localvideotrack')];
    mock('../../../../../lib/media/track/localmediatrack', function() {
      return class LocalMediaTrack {
        constructor() {
          this._log = log;
        }
        addProcessor() {
          parentClassContext.addProcessor(...arguments);
        }
        disable() {
          parentClassContext.disable(...arguments);
        }
        enable() {
          parentClassContext.enable(...arguments);
        }
      };
    });
    LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');
  });

  after(() => {
    mock.stopAll();
  });

  beforeEach(() => {
    parentClassContext.addProcessor = sinon.spy();
    parentClassContext.disable = sinon.spy();
    parentClassContext.enable = sinon.spy();

    mediaStreamTrack = new MediaStreamTrack('foo', 'video');
    localVideoTrack = new LocalVideoTrack(mediaStreamTrack, {});
    localVideoTrack._trackSender = {
      setMediaStreamTrack: sinon.stub().resolves({})
    };
  });

  describe('#addProcessor', () => {
    it('should call parent class method', () => {
      localVideoTrack.addProcessor('foo');
      sinon.assert.calledWith(parentClassContext.addProcessor, 'foo');
    });

    it('should not set RTCRtpSender if processedTrack is not available', () => {
      localVideoTrack.addProcessor();
      sinon.assert.notCalled(localVideoTrack._trackSender.setMediaStreamTrack);
    });

    it('should set RTCRtpSender if processedTrack is available', () => {
      localVideoTrack.processedTrack = 'foo';
      localVideoTrack.addProcessor();
      sinon.assert.calledWith(localVideoTrack._trackSender.setMediaStreamTrack, 'foo');
    });
  });

  describe('#enable', () => {
    it('should call parent class method', () => {
      localVideoTrack.enable();
      sinon.assert.calledOnce(parentClassContext.enable);
    });

    it('should enable processedTrack', () => {
      localVideoTrack.processedTrack = {};
      localVideoTrack.enable();
      assert(localVideoTrack.processedTrack.enabled);
    });
  });

  describe('#disable', () => {
    it('should call parent class method', () => {
      localVideoTrack.disable();
      sinon.assert.calledOnce(parentClassContext.disable);
    });

    it('should disable processedTrack', () => {
      localVideoTrack.processedTrack = {};
      localVideoTrack.disable();
      assert(localVideoTrack.processedTrack.enabled === false);
    });
  });
});
