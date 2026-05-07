'use strict';

const assert = require('assert');
const sinon = require('sinon');

const adapterPath = require.resolve('../../../lib/noisecancellationadapter');
const dynamicImportPath = require.resolve('../../../lib/util/dynamicimport');
const audioContextFactory = require('../../../lib/webaudio/audiocontext');
const log = require('../../lib/fakelog');

function installDynamicImportStub(modulesByPath) {
  require.cache[dynamicImportPath] = {
    id: dynamicImportPath,
    filename: dynamicImportPath,
    loaded: true,
    exports: path => {
      if (path in modulesByPath) {
        return Promise.resolve(modulesByPath[path]);
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    }
  };
}

function makeV1Plugin(overrides = {}) {
  return {
    init: sinon.stub().resolves(),
    isInitialized: sinon.stub().returns(true),
    isConnected: sinon.stub().returns(false),
    isEnabled: sinon.stub().returns(true),
    connect: sinon.stub(),
    disconnect: sinon.spy(),
    enable: sinon.spy(),
    disable: sinon.spy(),
    destroy: sinon.spy(),
    setLogging: sinon.spy(),
    isSupported: sinon.stub().returns(true),
    getVersion: sinon.stub().returns('1.0.0'),
    ...overrides
  };
}

function makeV2Plugin(overrides = {}) {
  return {
    init: sinon.stub().resolves(),
    isInitialized: sinon.stub().returns(true),
    isConnected: sinon.stub().returns(false),
    isEnabled: sinon.stub().returns(true),
    connect: sinon.stub(),
    disconnect: sinon.spy(),
    enable: sinon.spy(),
    disable: sinon.spy(),
    destroy: sinon.stub().resolves(),
    setLogging: sinon.spy(),
    isSupported: sinon.stub().returns(true),
    getVersion: sinon.stub().returns('2.0.0'),
    ...overrides
  };
}

describe('noisecancellationadapter', () => {
  let createNoiseCancellationAudioProcessor;

  function loadAdapter() {
    delete require.cache[adapterPath];
    ({ createNoiseCancellationAudioProcessor } = require(adapterPath));
  }

  afterEach(() => {
    delete require.cache[dynamicImportPath];
    delete require.cache[adapterPath];
  });

  describe('createNoiseCancellationAudioProcessor', () => {
    const sdkPath = '/krisp/krispsdk.mjs';
    const baseOptions = { vendor: 'krisp', sdkAssetsPath: '/krisp' };

    it('rejects when the vendor is not supported', async () => {
      installDynamicImportStub({});
      loadAdapter();
      await assert.rejects(
        createNoiseCancellationAudioProcessor({ vendor: 'unknown', sdkAssetsPath: '' }, log),
        /Unsupported NoiseCancellationOptions\.vendor/
      );
    });

    it('rejects when the module has no getVersion()', async () => {
      installDynamicImportStub({ [sdkPath]: { default: {} } });
      loadAdapter();
      await assert.rejects(
        createNoiseCancellationAudioProcessor(baseOptions, log),
        /Invalid noise cancellation plugin module/
      );
    });

    it('rejects when the plugin major is greater than the supported majors', async () => {
      const plugin = makeV2Plugin({ getVersion: () => '3.0.0' });
      installDynamicImportStub({ [sdkPath]: { default: plugin } });
      loadAdapter();
      await assert.rejects(
        createNoiseCancellationAudioProcessor(baseOptions, log),
        /Major version mismatch/
      );
    });

    it('rejects when the plugin minor is below the supported floor', async () => {
      // rnnoise supportedVersions is ['0.6.0']; a 0.5.x plugin must fail the minor floor.
      const rnnoisePath = '/rnnoise/rnnoise_sdk.mjs';
      const plugin = makeV1Plugin({ getVersion: () => '0.5.0' });
      installDynamicImportStub({ [rnnoisePath]: { default: plugin } });
      loadAdapter();
      await assert.rejects(
        createNoiseCancellationAudioProcessor(
          { vendor: 'rnnoise', sdkAssetsPath: '/rnnoise' },
          log
        ),
        /Minor version mismatch/
      );
    });

    it('rejects when the version string is malformed', async () => {
      const plugin = makeV2Plugin({ getVersion: () => '2.0' });
      installDynamicImportStub({ [sdkPath]: { default: plugin } });
      loadAdapter();
      await assert.rejects(
        createNoiseCancellationAudioProcessor(baseOptions, log),
        /Unsupported Plugin version format/
      );
    });

    it('accepts a pre-release version suffix', async () => {
      const plugin = makeV2Plugin({ getVersion: () => '2.0.0-rc.1' });
      installDynamicImportStub({ [sdkPath]: { default: plugin } });
      loadAdapter();
      const processor = await createNoiseCancellationAudioProcessor(baseOptions, log);
      assert.strictEqual(processor.vendor, 'krisp');
    });

    it('rejects when isSupported() returns false', async () => {
      const plugin = makeV2Plugin({ isSupported: sinon.stub().returns(false) });
      installDynamicImportStub({ [sdkPath]: { default: plugin } });
      loadAdapter();
      await assert.rejects(
        createNoiseCancellationAudioProcessor(baseOptions, log),
        /Noise Cancellation plugin is not supported on your browser/
      );
    });

    it('routes a 2.x plugin directly (async destroy)', async () => {
      const plugin = makeV2Plugin();
      installDynamicImportStub({ [sdkPath]: { default: plugin } });
      loadAdapter();
      const processor = await createNoiseCancellationAudioProcessor(baseOptions, log);
      const destroyResult = processor.destroy();
      assert.strictEqual(typeof destroyResult.then, 'function');
      await destroyResult;
      sinon.assert.calledOnce(plugin.destroy);
      sinon.assert.calledWithExactly(plugin.isSupported);
    });

    it('routes a 1.x plugin through LegacyPluginAdapter (sync legacy destroy)', async () => {
      // LegacyPluginAdapter.isSupported borrows an AudioContext from the factory;
      // stub it so the legacy probe runs without a real Web Audio environment.
      const ctx = { sampleRate: 48000 };
      const getOrCreate = sinon.stub(audioContextFactory, 'getOrCreate').returns(ctx);
      const release = sinon.stub(audioContextFactory, 'release');
      try {
        const plugin = makeV1Plugin();
        installDynamicImportStub({ [sdkPath]: { default: plugin } });
        loadAdapter();
        const processor = await createNoiseCancellationAudioProcessor(baseOptions, log);
        sinon.assert.calledWith(plugin.isSupported, ctx);
        const destroyResult = processor.destroy();
        assert.strictEqual(typeof destroyResult.then, 'function');
        // Legacy sync destroy must be invoked on a later tick, not synchronously.
        sinon.assert.notCalled(plugin.destroy);
        await destroyResult;
        sinon.assert.calledOnce(plugin.destroy);
      } finally {
        getOrCreate.restore();
        release.restore();
      }
    });

    it('caches the processor per vendor on subsequent calls', async () => {
      const plugin = makeV2Plugin();
      installDynamicImportStub({ [sdkPath]: { default: plugin } });
      loadAdapter();
      const first = await createNoiseCancellationAudioProcessor(baseOptions, log);
      const second = await createNoiseCancellationAudioProcessor(baseOptions, log);
      assert.strictEqual(first, second);
    });
  });
});
