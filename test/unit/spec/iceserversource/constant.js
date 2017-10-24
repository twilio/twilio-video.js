'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const ConstantIceServerSource = require('../../../../lib/iceserversource/constant');

describe('ConstantIceServerSource', () => {
  describe('constructor', () => {
    it('returns an instance of ConstantIceServerSource', () => {
      assert(new ConstantIceServerSource([]) instanceof ConstantIceServerSource);
    });

    it('the returned instance extends EventEmitter', () => {
      assert(new ConstantIceServerSource([]) instanceof EventEmitter);
    });
  });

  describe('start', () => {
    describe('when neither start nor stop have been called', () => {
      it('returns a Promise that resolves to the ICE servers passed to the constructor', () => {
        const iceServers = [];
        const ciss = new ConstantIceServerSource(iceServers);
        return ciss.start().then(_iceServers => {
          assert.equal(_iceServers, iceServers);
        });
      });
    });

    describe('when start has been called', () => {
      it('returns a Promise that resolves to the ICE servers passed to the constructor', () => {
        const iceServers = [];
        const ciss = new ConstantIceServerSource(iceServers);
        return ciss.start().then(() => {
          return ciss.start();
        }).then(_iceServers => {
          assert.equal(_iceServers, iceServers);
        });
      });
    });

    describe('when stop has been called', () => {
      it('returns a Promise that resolves to the ICE servers passed to the constructor', () => {
        const iceServers = [];
        const ciss = new ConstantIceServerSource(iceServers);
        ciss.stop();
        return ciss.start().then(_iceServers => {
          assert.equal(_iceServers, iceServers);
        });
      });
    });

    describe('when start and stop have been called', () => {
      it('returns a Promise that resolves to the ICE servers passed to the constructor', () => {
        const iceServers = [];
        const ciss = new ConstantIceServerSource(iceServers);
        return ciss.start().then(() => {
          ciss.stop();
        }).then(() => {
          return ciss.start();
        }).then(_iceServers => {
          assert.equal(_iceServers, iceServers);
        });
      });
    });
  });

  describe('stop', () => {
    describe('when neither start nor stop have been called', () => {
      it('returns undefined', () => {
        const ciss = new ConstantIceServerSource([]);
        assert.equal(ciss.stop(), undefined);
      });
    });

    describe('when start has been called', () => {
      it('returns undefined', () => {
        const ciss = new ConstantIceServerSource([]);
        return ciss.start().then(() => {
          assert.equal(ciss.stop(), undefined);
        });
      });
    });

    describe('when stop has been called', () => {
      it('returns undefined', () => {
        const ciss = new ConstantIceServerSource([]);
        ciss.stop();
        assert.equal(ciss.stop(), undefined);
      });
    });

    describe('when start and stop have been called', () => {
      it('returns undefined', () => {
        const ciss = new ConstantIceServerSource([]);
        return ciss.start().then(() => {
          ciss.stop();
          assert.equal(ciss.stop(), undefined);
        });
      });
    });
  });
});
