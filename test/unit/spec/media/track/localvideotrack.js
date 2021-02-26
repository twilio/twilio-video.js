'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mock = require('mock-require');
const log = require('../../../../lib/fakelog');
const { FakeMediaStreamTrack: MediaStreamTrack } = require('../../../../lib/fakemediastream');

describe('LocalVideoTrack', () => {
  const parentClassContext = {};
  const internalPromise = () => Promise.resolve().then(Promise.resolve());
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
        _canCaptureFrames() {
          return parentClassContext._canCaptureFrames(...arguments);
        }
        _captureFrames() {
          parentClassContext._captureFrames(...arguments);
        }
        addProcessor() {
          return parentClassContext.addProcessor(...arguments);
        }
        removeProcessor() {
          return parentClassContext.removeProcessor(...arguments);
        }
        disable() {
          return parentClassContext.disable(...arguments);
        }
        enable() {
          return parentClassContext.enable(...arguments);
        }
        restart() {
          return parentClassContext.restart(...arguments);
        }
      };
    });
    LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');
  });

  after(() => {
    mock.stopAll();
  });

  beforeEach(() => {
    parentClassContext._canCaptureFrames = sinon.spy();
    parentClassContext._captureFrames = sinon.spy();
    parentClassContext.addProcessor = sinon.spy();
    parentClassContext.removeProcessor = sinon.spy();
    parentClassContext.disable = sinon.spy();
    parentClassContext.enable = sinon.spy();
    parentClassContext.restart = sinon.stub().resolves({});

    mediaStreamTrack = new MediaStreamTrack('foo', 'video');
    localVideoTrack = new LocalVideoTrack(mediaStreamTrack, {});
    localVideoTrack._trackSender = {
      setMediaStreamTrack: sinon.stub().resolves({}),
      _clones: new Set()
    };
    localVideoTrack._updateElementsMediaStreamTrack = sinon.stub();
    localVideoTrack.mediaStreamTrack = mediaStreamTrack;
  });

  describe('#_canCaptureFrames', () => {
    it('should call parent class method with isPublishing equal to false', () => {
      localVideoTrack._canCaptureFrames();
      sinon.assert.calledWith(parentClassContext._canCaptureFrames, false);
    });
    it('should call parent class method with isPublishing equal to true', () => {
      localVideoTrack._trackSender._clones.add('foo');
      localVideoTrack._canCaptureFrames();
      sinon.assert.calledWith(parentClassContext._canCaptureFrames, true);
    });
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

  describe('#removeProcessor', () => {
    beforeEach(() => {
      localVideoTrack._unprocessedTrack = 'bar';
      localVideoTrack.removeProcessor('foo');
    });

    it('should call parent class method', () => {
      sinon.assert.calledWith(parentClassContext.removeProcessor, 'foo');
    });

    it('should set RTCRtpSender with the original mediaStreamTrack', () => {
      sinon.assert.calledWith(localVideoTrack._trackSender.setMediaStreamTrack, mediaStreamTrack);
    });

    it('should set attached elements srcObject with the original mediaStreamTrack', async () => {
      // Resolves _trackSender.setMediaStreamTrack
      await internalPromise();
      // Trigger the 'then' callback
      await internalPromise();
      sinon.assert.called(localVideoTrack._updateElementsMediaStreamTrack);
    });

    it('should set unprocessedTrack to null after trackSender.setMediaStreamTrack resolves', async () => {
      assert.equal(localVideoTrack._unprocessedTrack, 'bar');
      // Resolves _trackSender.setMediaStreamTrack
      await internalPromise();
      // Trigger the 'then' callback
      await internalPromise();
      assert.equal(localVideoTrack._unprocessedTrack, null);
    });
  });

  describe('#enable', () => {
    it('should call parent class method', () => {
      localVideoTrack.enable();
      sinon.assert.calledOnce(parentClassContext.enable);
    });

    [true, undefined].forEach(param => {
      context(`when enabled parameter is ${param}`, () => {
        it('should enable processedTrack', () => {
          localVideoTrack.processedTrack = {};
          localVideoTrack.enable(param);
          assert(localVideoTrack.processedTrack.enabled);
        });

        it('should start capturing frames if processedTrack is available', () => {
          localVideoTrack.processedTrack = { foo: 'foo' };
          localVideoTrack.enable(param);
          sinon.assert.calledOnce(parentClassContext._captureFrames);
          sinon.assert.calledWith(localVideoTrack._trackSender.setMediaStreamTrack, { enabled: true, foo: 'foo' });
        });

        it('should not start capturing frames if processedTrack is not available', () => {
          localVideoTrack.enable(param);
          sinon.assert.notCalled(parentClassContext._captureFrames);
          sinon.assert.notCalled(localVideoTrack._trackSender.setMediaStreamTrack);
        });
      });
    });

    context('when enabled parameter is false', () => {
      it('should disable processedTrack', () => {
        localVideoTrack.processedTrack = {};
        localVideoTrack.enable(false);
        assert(!localVideoTrack.processedTrack.enabled);
      });

      it('should not start capturing frames if processedTrack is available', () => {
        localVideoTrack.processedTrack = {};
        localVideoTrack.enable(false);
        sinon.assert.notCalled(parentClassContext._captureFrames);
        sinon.assert.notCalled(localVideoTrack._trackSender.setMediaStreamTrack);
      });
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

  describe('#restart', () => {
    beforeEach(() => {
      localVideoTrack._restartProcessor = sinon.stub();
    });

    it('should call parent class method', () => {
      localVideoTrack.restart();
      sinon.assert.calledOnce(parentClassContext.restart);
    });

    it('should not call _restartProcessor if no VideoProcessor is added', () => {
      localVideoTrack.restart();
      sinon.assert.notCalled(localVideoTrack._restartProcessor);
    });

    it('should call restart and _restartProcessor in the correct order', async () => {
      localVideoTrack.processor = 'foo';
      localVideoTrack.restart();
      await internalPromise();
      sinon.assert.calledOnce(parentClassContext.restart);
      sinon.assert.calledOnce(localVideoTrack._restartProcessor);

      sinon.assert.callOrder(parentClassContext.restart, localVideoTrack._restartProcessor);
    });
  });
});
