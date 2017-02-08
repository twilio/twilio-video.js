'use strict';

const assert = require('assert');
const EventEmitter = require('events').EventEmitter;
const NTSIceServerSource = require('../../../../lib/iceserversource/nts');
const util = require('../../../../lib/util');

const token = 'foo';
const iceServers = [];
const config = {
  video: {
    network_traversal_service: {
      ice_servers: iceServers,
      ttl: 1
    }
  }
};

describe('NTSIceServerSource', () => {
  describe('constructor', () => {
    it('returns an instance of NTSIceServerSource', () => {
      assert(new NTSIceServerSource('') instanceof NTSIceServerSource);
    });

    it('the returned instance extends EventEmitter', () => {
      assert(new NTSIceServerSource('') instanceof EventEmitter);
    });
  });

  describe('start', () => {
    describe('when neither start nor stop have been called', () => {
      let nts;

      it('returns a Promise that resolves to the ICE servers', () => {
        const options = { getConfiguration: () => Promise.resolve(config) };
        nts = new NTSIceServerSource(token, options);
        return nts.start().then(_iceServers => {
          assert.equal(_iceServers, iceServers);
        });
      });

      afterEach(() => {
        nts.stop();
      });
    });

    describe('when start has been called', () => {
      let nts;

      it('returns a Promise that resolves to the ICE servers', () => {
        const options = { getConfiguration: () => Promise.resolve(config) };
        nts = new NTSIceServerSource(token, options);
        return nts.start().then(() => {
          return nts.start();
        }).then(_iceServers => {
          assert.equal(_iceServers, iceServers);
        });
      });

      afterEach(() => {
        nts.stop();
      });
    });

    describe('when stop has been called', () => {
      let nts;

      it('returns a Promise that resolves to the ICE servers', () => {
        const options = { getConfiguration: () => Promise.resolve(config) };
        nts = new NTSIceServerSource(token, options);
        nts.stop();
        return nts.start().then(_iceServers => {
          assert.equal(_iceServers, iceServers);
        });
      });

      afterEach(() => {
        nts.stop();
      });
    });

    describe('when start and stop have been called', () => {
      let nts;

      it('returns a Promise that resolves to the ICE servers', () => {
        const options = { getConfiguration: () => Promise.resolve(config) };
        nts = new NTSIceServerSource(token, options);
        return nts.start().then(() => {
          nts.stop();
        }).then(() => {
          return nts.start();
        }).then(_iceServers => {
          assert.equal(_iceServers, iceServers);
        });
      });

      afterEach(() => {
        nts.stop();
      });
    });

    describe('when getConfiguration times out', () => {
      let nts;

      it('returns the default ICE servers', () => {
        const options = { getConfiguration: () => util.defer().promise, timeout: 1 };
        nts = new NTSIceServerSource(token, options);
        return nts.start().then(iceServers => {
          assert.deepEqual([
            {
              "urls": "stun:global.stun.twilio.com:3478?transport=udp"
            }
          ], iceServers);
        });
      });

      afterEach(() => {
        nts.stop();
      });
    });

    describe('when getConfiguration resolves with malformed configuration', () => {
      let nts;

      it('returns the default ICE servers', () => {
        const options = { getConfiguration: () => Promise.resolve({}) };
        nts = new NTSIceServerSource(token, options);
        return nts.start().then(iceServers => {
          assert.deepEqual([
            {
              "urls": "stun:global.stun.twilio.com:3478?transport=udp"
            }
          ], iceServers);
        });
      });

      afterEach(() => {
        nts.stop();
      });
    });

    describe('when getConfiguration rejects', () => {
      let nts;

      it('returns the default ICE servers', () => {
        const options = { getConfiguration: () => Promise.reject() };
        nts = new NTSIceServerSource(token, options);
        return nts.start().then(iceServers => {
          assert.deepEqual([
            {
              "urls": "stun:global.stun.twilio.com:3478?transport=udp"
            }
          ], iceServers);
        });
      });

      afterEach(() => {
        nts.stop();
      });
    });

    let nts;

    it('schedules a new fetch of ICE servers and emits them via the "iceServers" event', () => {
      const options = { getConfiguration: () => Promise.resolve(config) };
      nts = new NTSIceServerSource(token, options);
      return nts.start().then(() => {
        return new Promise(resolve => nts.once('iceServers', resolve));
      }).then(_iceServers => {
        assert.equal(_iceServers, iceServers);
      });
    });

    afterEach(() => {
      if (nts) {
        nts.stop();
      }
    });
  });

  describe('stop', () => {
    describe('when neither start nor stop have been called', () => {
      it('returns undefined', () => {
        const options = { getConfiguration: () => Promise.resolve(config) };
        const nts = new NTSIceServerSource(token, options);
        assert.equal(nts.stop(), undefined);
      });
    });

    describe('when start has been called', () => {
      it('returns undefined', () => {
        const options = { getConfiguration: () => Promise.resolve(config) };
        const nts = new NTSIceServerSource(token, options);
        return nts.start().then(() => {
          assert.equal(nts.stop(), undefined);
        });
      });
    });

    describe('when stop has been called', () => {
      it('returns undefined', () => {
        const options = { getConfiguration: () => Promise.resolve(config) };
        const nts = new NTSIceServerSource(token, options);
        nts.stop();
        assert.equal(nts.stop(), undefined);
      });
    });

    describe('when start and stop have been called', () => {
      it('returns undefined', () => {
        const options = { getConfiguration: () => Promise.resolve(config) };
        const nts = new NTSIceServerSource(token, options);
        return nts.start().then(() => {
          nts.stop();
          assert.equal(nts.stop(), undefined);
        });
      });
    });
  });
});
