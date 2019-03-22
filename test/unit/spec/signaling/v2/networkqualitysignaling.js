'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const NetworkQualitySignaling = require('../../../../../lib/signaling/v2/networkqualitysignaling');

class MockMediaSignalingTransport extends EventEmitter {
  constructor() {
    super();
    this.publish = sinon.spy(this.publish.bind(this));
  }

  publish() {
    return true;
  }
}

describe('NetworkQualitySignaling', () => {
  let clock;
  let mst;
  let nqs;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    mst = new MockMediaSignalingTransport();
    nqs = new NetworkQualitySignaling(mst);
  });

  afterEach(() => {
    clock.restore();
  });

  describe('#put', () => {
    describe('when no NetworkQualityInputs have been submitted', () => {
      it('calls .publish on the underlying MediaSignalingTransport', async () => {
        const inputs = createInputs();
        nqs.put(inputs);
        await wait();
        didPublish(mst, inputs);
      });
    });

    describe('when NetworkQualityInputs have been submitted,', () => {
      beforeEach(async () => {
        const inputs = createInputs();
        nqs.put(inputs);
        await wait();
        didPublish(mst, inputs);
      });

      describe('but no NetworkQualityLevel has been received,', () => {
        describe('and #put has been called once,', () => {
          let inputs;

          beforeEach(async () => {
            inputs = createInputs();
            nqs.put(inputs);
            await wait();
            didNotPublish(mst, inputs);
          });

          it('calls .publish on the underlying MediaSignalingTransport 1 s after receiving a NetworkQualityLevel', async () => {
            receiveMessage(mst);
            clock.tick(1000);
            await wait();
            didPublish(mst, inputs);
          });
        });

        describe('and #put has been called multiple times,', () => {
          let inputs;

          beforeEach(async () => {
            nqs.put(createInputs());
            nqs.put(createInputs());
            inputs = createInputs();
            nqs.put(inputs);
            await wait();
            didNotPublish(mst, inputs);
          });

          it('calls .publish on the underlying MediaSignalingTransport 1 s after receiving a NetworkQualityLevel with the most recent NetworkQualityInputs', async () => {
            receiveMessage(mst);
            clock.tick(1000);
            await wait();
            didPublish(mst, inputs);
          });
        });
      });

      describe('a NetworkQualityLevel have been received,', () => {
        beforeEach(() => {
          receiveMessage(mst);
        });

        describe('1 s has not yet elapsed,', () => {
          describe('and #put has been called once,', () => {
            let inputs;

            beforeEach(async () => {
              inputs = createInputs();
              nqs.put(inputs);
              await wait();
              didNotPublish(mst);
            });

            it('calls .publish on the underlying MediaSignalingTransport once 1 s elapses', async () => {
              clock.tick(1000);
              await wait();
              didPublish(mst, inputs);
            });
          });

          describe('and #put has been called multiple times,', () => {
            let inputs;

            beforeEach(async () => {
              nqs.put(createInputs());
              nqs.put(createInputs());
              inputs = createInputs();
              nqs.put(inputs);
              await wait();
              didNotPublish(mst);
            });

            it('calls .publish on the underlying MediaSignalingTransport once 1 s elapses with the most recent NetworkQualityInputs', async () => {
              clock.tick(1000);
              await wait();
              didPublish(mst, inputs);
            });
          });
        });

        describe('1 s has elapsed,', () => {
          beforeEach(() => {
            clock.tick(1000);
          });

          describe('and #put has been called once,', () => {
            let inputs;

            beforeEach(async () => {
              inputs = createInputs();
              nqs.put(inputs);
              await wait();
            });

            it('calls .publish on the underlying MediaSignalingTransport', () => {
              didPublish(mst, inputs);
            });
          });

          describe('and #put has been called multiple times,', () => {
            let inputs;

            beforeEach(async () => {
              inputs = createInputs();
              nqs.put(inputs);
              nqs.put(createInputs());
              nqs.put(createInputs());
              await wait();
            });

            it('calls .publish on the underlying MediaSignalingTransport with the *first* NetworkQualityInputs', () => {
              didPublish(mst, inputs);
            });
          });
        });
      });
    });
  });

  describe('when the underlying MediaSignalingTransport receives', () => {
    let mst;
    let nqs;

    beforeEach(() => {
      mst = new MockMediaSignalingTransport();
      nqs = new NetworkQualitySignaling(mst);
    });

    describe('a "network_quality" message with', () => {
      describe('a new NetworkQualityLevel', () => {
        describe('and the NetworkQualitySignaling has never had NetworkQualityLevel set before', () => {
          let level;
          let levels;

          beforeEach(() => {
            levels = createLevels();
            level = levels.level;
          });

          it('emits "updated"', () => {
            let didEmitEvent = false;
            nqs.once('updated', () => { didEmitEvent = true; });
            receiveMessage(mst, levels);
            assert(didEmitEvent);
          });

          it('sets .level to the new NetworkQualityLevel', () => {
            receiveMessage(mst, levels);
            assert.equal(level, nqs.level);
          });

          it('sets .levels to the new local levels', () => {
            receiveMessage(mst, levels);
            assert.equal(levels, nqs.levels);
          });

          it('sets .remoteLevels to empty map', () => {
            receiveMessage(mst, levels);
            assert.equal(0, nqs.remoteLevels.size);
          });
        });

        describe('and the NetworkQualitySignaling has had NetworkQualityLevel set before', () => {
          let level;
          let levels;

          beforeEach(() => {
            receiveMessage(mst);
            levels = createLevels();
            level = levels.level;
          });

          it('emits "updated"', () => {
            let didEmitEvent = false;
            nqs.once('updated', () => { didEmitEvent = true; });
            receiveMessage(mst, levels);
            assert(didEmitEvent);
          });

          it('sets .level to the new NetworkQualityLevel', () => {
            receiveMessage(mst, levels);
            assert.equal(level, nqs.level);
          });

          it('sets .levels to new local levels', () => {
            receiveMessage(mst, levels);
            assert.equal(levels, nqs.levels);
          });

          it('sets .remoteLevels to empty map', () => {
            receiveMessage(mst, levels);
            assert.equal(0, nqs.remoteLevels.size);
          });
        });
      });

      describe('unchanged NetworkQualityLevel', () => {
        let level;
        let levels;

        beforeEach(() => {
          levels = createLevels();
          level = levels.level;
          receiveMessage(mst, levels);
        });

        it('does not emit "updated"', () => {
          let didEmitEvent = false;
          nqs.once('updated', () => { didEmitEvent = true; });
          receiveMessage(mst, levels);
          assert(!didEmitEvent);
        });

        it('does not change .level', () => {
          receiveMessage(mst, levels);
          assert.equal(level, nqs.level);
        });

        it('does not change .levels', () => {
          receiveMessage(mst, levels);
          assert.equal(levels, nqs.levels);
        });

        it('does not change .remoteLevels', () => {
          receiveMessage(mst, levels);
          assert.equal(0, nqs.remoteLevels.size);
        });
      });
    });

    describe('an unknown message', () => {
      it('does not emit "updated"', () => {
        let didEmitEvent = false;
        nqs.once('updated', () => { didEmitEvent = true; });
        mst.emit('message', { type: 'foo' });
        assert(!didEmitEvent);
      });

      it('does not change .level', () => {
        mst.emit('message', { type: 'foo' });
        assert.equal(null, nqs.level);
      });
    });
  });
});

function createInputs() {
  // NOTE(mroberts): Intentionally unspecified.
  return {};
}

function createLevels() {
  return {
    level: Math.random(),
    audio: {
      send: Math.random(),
      recv: Math.random()
    },
    video: {
      send: Math.random(),
      recv: Math.random()
    }
  };
}

function createMessage(levels) {
  return Object.assign({
    type: 'network_quality'
  }, {
    local: levels || createLevels(),
    remotes: null
  });
}

function didNotPublish(mst) {
  sinon.assert.notCalled(mst.publish);
}

function didPublish(mst) {
  sinon.assert.calledOnce(mst.publish);
  sinon.assert.calledWith(mst.publish, {
    type: 'network_quality',
    reportLevel: 1,
    remoteReportLevel: 0
  });
  mst.publish.reset();
}

function receiveMessage(mst, levels) {
  mst.emit('message', createMessage(levels));
}

async function wait() {
  await Promise.resolve();
}
