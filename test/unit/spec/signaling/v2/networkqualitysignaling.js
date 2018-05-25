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
        const inputs = createNetworkQualityInputs();
        nqs.put(inputs);
        await wait();
        didPublish(mst, inputs);
      });
    });

    describe('when NetworkQualityInputs have been submitted,', () => {
      beforeEach(async () => {
        const inputs = createNetworkQualityInputs();
        nqs.put(inputs);
        await wait();
        didPublish(mst, inputs);
      });

      describe('but no NetworkQualityLevels have been received,', () => {
        describe('and #put has been called once,', () => {
          let inputs;

          beforeEach(async () => {
            inputs = createNetworkQualityInputs();
            nqs.put(inputs);
            await wait();
            didNotPublish(mst, inputs);
          });

          it('calls .publish on the underlying MediaSignalingTransport 1 s after receiving NetworkQualityLevels', async () => {
            receiveNetworkQualityLevels(mst);
            clock.tick(1000);
            await wait();
            didPublish(mst, inputs);
          });
        });

        describe('and #put has been called multiple times,', () => {
          let inputs;

          beforeEach(async () => {
            nqs.put(createNetworkQualityInputs());
            nqs.put(createNetworkQualityInputs());
            inputs = createNetworkQualityInputs();
            nqs.put(inputs);
            await wait();
            didNotPublish(mst, inputs);
          });

          it('calls .publish on the underlying MediaSignalingTransport 1 s after receiving a NetworkQualityLevels with the most recent NetworkQualityInputs', async () => {
            receiveNetworkQualityLevels(mst);
            clock.tick(1000);
            await wait();
            didPublish(mst, inputs);
          });
        });
      });

      describe('NetworkQualityLevels have been received,', () => {
        beforeEach(() => {
          receiveNetworkQualityLevels(mst);
        });

        describe('1 s has not yet elapsed,', () => {
          describe('and #put has been called once,', () => {
            let inputs;

            beforeEach(async () => {
              inputs = createNetworkQualityInputs();
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
              nqs.put(createNetworkQualityInputs());
              nqs.put(createNetworkQualityInputs());
              inputs = createNetworkQualityInputs();
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
              inputs = createNetworkQualityInputs();
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
              inputs = createNetworkQualityInputs();
              nqs.put(inputs);
              nqs.put(createNetworkQualityInputs());
              nqs.put(createNetworkQualityInputs());
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
      describe('new NetworkQualityLevels', () => {
        describe('and the NetworkQualitySignaling has never had NetworkQualityLevels set before', () => {
          let levels;

          beforeEach(() => {
            levels = createNetworkQualityLevels();
          });

          it('emits "networkQualityLevelsChanged"', () => {
            let didEmitEvent = false;
            nqs.once('networkQualityLevelsChanged', () => { didEmitEvent = true; });
            receiveNetworkQualityLevels(mst, levels);
            assert(didEmitEvent);
          });

          it('sets .networkQualityLevels to the new NetworkQualityLevels', () => {
            receiveNetworkQualityLevels(mst, levels);
            assert.deepEqual(levels, nqs.networkQualityLevels);
          });
        });

        describe('and the NetworkQualitySignaling has had NetworkQualityLevels set before', () => {
          let levels;

          beforeEach(() => {
            receiveNetworkQualityLevels(mst);
            levels = createNetworkQualityLevels();
          });

          it('emits "networkQualityLevelsChanged"', () => {
            let didEmitEvent = false;
            nqs.once('networkQualityLevelsChanged', () => { didEmitEvent = true; });
            receiveNetworkQualityLevels(mst, levels);
            assert(didEmitEvent);
          });

          it('sets .networkQualityLevels to the new NetworkQualityLevels', () => {
            receiveNetworkQualityLevels(mst, levels);
            assert.deepEqual(levels, nqs.networkQualityLevels);
          });
        });
      });

      describe('unchanged NetworkQualityLevels', () => {
        let levels;

        beforeEach(() => {
          levels = createNetworkQualityLevels();
          receiveNetworkQualityLevels(mst, levels);
        });

        it('does not emit "networkQualityLevelsChanged"', () => {
          let didEmitEvent = false;
          nqs.once('networkQualityLevelsChanged', () => { didEmitEvent = true; });
          receiveNetworkQualityLevels(mst, levels);
          assert(!didEmitEvent);
        });

        it('does not change .networkQualityLevels', () => {
          receiveNetworkQualityLevels(mst, levels);
          assert.deepEqual(levels, nqs.networkQualityLevels);
        });
      });
    });

    describe('an unknown message', () => {
      it('does not emit "networkQualityLevelsChanged"', () => {
        let didEmitEvent = false;
        nqs.once('networkQualityLevelsChanged', () => { didEmitEvent = true; });
        mst.emit('message', { type: 'foo' });
        assert(!didEmitEvent);
      });

      it('does not change .networkQualityLevels', () => {
        mst.emit('message', { type: 'foo' });
        assert.equal(null, nqs.networkQualityLevels);
      });
    });
  });
});

function createNetworkQualityInputs() {
  // NOTE(mroberts): Intentionally unspecified.
  return {};
}

function createNetworkQualityLevels() {
  return {
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

function createNetworkQualityLevelsMessage(networkQualityLevels) {
  return Object.assign({
    type: 'network_quality'
  }, {
    local: networkQualityLevels || createNetworkQualityLevels()
  });
}

function didNotPublish(mst) {
  sinon.assert.notCalled(mst.publish);
}

function didPublish(mst) {
  sinon.assert.calledOnce(mst.publish);
  sinon.assert.calledWith(mst.publish, {
    type: 'network_quality'
  });
  mst.publish.reset();
}

function receiveNetworkQualityLevels(mst, networkQualityLevels) {
  mst.emit('message', createNetworkQualityLevelsMessage(networkQualityLevels));
}

async function wait() {
  await Promise.resolve();
}
