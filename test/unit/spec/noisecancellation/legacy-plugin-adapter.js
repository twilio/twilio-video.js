'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { LegacyPluginAdapter } = require('../../../../lib/noisecancellation/legacy-plugin-adapter');
const audioContextFactory = require('../../../../lib/webaudio/audiocontext');

describe('LegacyPluginAdapter', () => {
  let legacy;
  let adapter;

  beforeEach(() => {
    legacy = {
      init: sinon.stub().resolves(),
      isInitialized: sinon.stub().returns(true),
      isConnected: sinon.stub().returns(false),
      isEnabled: sinon.stub().returns(true),
      connect: sinon.stub().returns({ id: 'output-stream' }),
      disconnect: sinon.spy(),
      enable: sinon.spy(),
      disable: sinon.spy(),
      destroy: sinon.spy(),
      setLogging: sinon.spy(),
      isSupported: sinon.stub().returns(true),
      getVersion: sinon.stub().returns('1.0.0')
    };
    adapter = new LegacyPluginAdapter(legacy);
  });

  describe('#isSupported', () => {
    let getOrCreate;
    let release;

    beforeEach(() => {
      getOrCreate = sinon.stub(audioContextFactory, 'getOrCreate');
      release = sinon.stub(audioContextFactory, 'release');
    });

    afterEach(() => {
      getOrCreate.restore();
      release.restore();
    });

    it('acquires a context, passes it to legacy.isSupported, and releases the holder', () => {
      const ctx = { sampleRate: 48000 };
      getOrCreate.returns(ctx);
      legacy.isSupported.returns(true);

      const result = adapter.isSupported();

      assert.strictEqual(result, true);
      sinon.assert.calledOnce(getOrCreate);
      sinon.assert.calledWith(legacy.isSupported, ctx);
      sinon.assert.calledOnce(release);
    });

    it('returns false without calling legacy.isSupported when getOrCreate returns null', () => {
      getOrCreate.returns(null);

      const result = adapter.isSupported();

      assert.strictEqual(result, false);
      sinon.assert.notCalled(legacy.isSupported);
      sinon.assert.calledOnce(release);
    });

    it('releases the holder even when legacy.isSupported throws', () => {
      const ctx = { sampleRate: 48000 };
      getOrCreate.returns(ctx);
      legacy.isSupported.throws(new Error('boom'));

      assert.throws(() => adapter.isSupported(), /boom/);
      sinon.assert.calledOnce(release);
    });
  });

  describe('#destroy', () => {
    it('promotes legacy.destroy into an awaitable that propagates errors', async () => {
      legacy.destroy = sinon.stub()
        .onFirstCall().returns(undefined)
        .onSecondCall().throws(new Error('legacy destroy failed'));

      await adapter.destroy();
      await assert.rejects(adapter.destroy(), /legacy destroy failed/);
      sinon.assert.calledTwice(legacy.destroy);
    });
  });
});
