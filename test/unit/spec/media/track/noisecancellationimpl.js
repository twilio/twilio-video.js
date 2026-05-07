'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { NoiseCancellationImpl } = require('../../../../../lib/media/track/noisecancellationimpl');

describe('NoiseCancellationImpl', () => {
  describe('#reacquireTrack', () => {
    let processor;
    let sourceTrack;
    let reacquiredTrack;
    let processedTrack;
    let reacquire;
    let impl;

    beforeEach(() => {
      sourceTrack = { id: 'source' };
      reacquiredTrack = { id: 'reacquired' };
      processedTrack = { id: 'processed' };

      processor = {
        vendor: 'krisp',
        isInitialized: sinon.stub().returns(true),
        isConnected: sinon.stub().returns(true),
        isEnabled: sinon.stub().returns(true),
        disconnect: sinon.spy(),
        enable: sinon.spy(),
        disable: sinon.spy(),
        destroy: sinon.stub().resolves(),
        setLogging: sinon.spy(),
        connect: sinon.stub().returns(processedTrack)
      };

      reacquire = sinon.stub().resolves(reacquiredTrack);
      impl = new NoiseCancellationImpl(processor, sourceTrack);
    });

    it('disconnects, reacquires the source, connects the new track, and updates sourceTrack', async () => {
      const result = await impl.reacquireTrack(reacquire);
      sinon.assert.calledOnce(processor.disconnect);
      sinon.assert.calledOnce(reacquire);
      sinon.assert.calledWith(processor.connect, reacquiredTrack);
      assert.strictEqual(result, processedTrack);
      assert.strictEqual(impl.sourceTrack, reacquiredTrack);
    });
  });
});
