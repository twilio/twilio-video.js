'use strict';

const assert = require('assert');

const MODULE_PATH = require.resolve('../../../../lib/util/dynamicimport');

// Replaces global.Function for calls that build a function using import(). Other calls, such as
// the one in nyc's coverage preamble, still reach the real constructor. Returns a restore function.
function stubImportFunction(createImportFunction) {
  const { Function: OriginalFunction } = global;
  global.Function = function(...args) {
    return String(args[args.length - 1]).includes('import(')
      ? createImportFunction()
      : new OriginalFunction(...args);
  };
  return () => {
    global.Function = OriginalFunction;
  };
}

describe('dynamicImport', () => {
  beforeEach(() => {
    // Other specs load this module first, with no location and with mockwebrtc's URL stub.
    delete require.cache[MODULE_PATH];
  });

  afterEach(() => {
    delete global.location;
    delete global.__twilioVideoImportedModules;
    delete global.__dynamicImportProbe;
    delete require.cache[MODULE_PATH];
  });

  it('treats the module path as data, not code', async () => {
    global.location = 'https://localhost/';
    global.__dynamicImportProbe = false;
    const { URL: MockURL } = global;
    // With mockwebrtc's URL stub, the path never reaches the import function.
    global.URL = require('url').URL;
    try {
      const dynamicImport = require(MODULE_PATH);
      const path = 'a\'+(global.__dynamicImportProbe=true)+\'b.mjs';
      await dynamicImport(path).then(() => {}, () => {});
    } finally {
      global.URL = MockURL;
    }

    assert.strictEqual(global.__dynamicImportProbe, false);
  });

  it('imports the module at the path resolved against location', async () => {
    global.location = 'https://localhost/sdk/';
    const { URL: MockURL } = global;
    // test/lib/mockwebrtc.js replaces URL with a stub that can't resolve paths.
    global.URL = require('url').URL;
    const importedUrls = [];
    const restoreFunction = stubImportFunction(() => url => {
      importedUrls.push(url);
      return Promise.resolve({});
    });
    try {
      const dynamicImport = require(MODULE_PATH);
      await dynamicImport('krisp/plugin.mjs');
    } finally {
      restoreFunction();
      global.URL = MockURL;
    }

    assert.deepStrictEqual(importedUrls, ['https://localhost/sdk/krisp/plugin.mjs']);
  });

  it('does not construct the import function when the module loads', () => {
    global.location = 'https://localhost/';
    // A Content Security Policy without 'unsafe-eval' makes the Function constructor throw.
    const restoreFunction = stubImportFunction(() => {
      throw new EvalError('Function constructor is blocked');
    });
    try {
      assert.doesNotThrow(() => require(MODULE_PATH));
    } finally {
      restoreFunction();
    }
  });
});
