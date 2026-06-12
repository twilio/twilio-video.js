'use strict';

const assert = require('assert');

const MODULE_PATH = require.resolve('../../../../lib/util/dynamicimport');

describe('dynamicImport', () => {
  afterEach(() => {
    delete global.location;
    delete global.__twilioVideoImportedModules;
    delete global.__dynamicImportProbe;
    delete require.cache[MODULE_PATH];
  });

  it('treats the module path as data, not code', async () => {
    global.location = 'https://localhost/';
    global.__dynamicImportProbe = false;

    const dynamicImport = require(MODULE_PATH);
    const path = 'a\'+(global.__dynamicImportProbe=true)+\'b.mjs';

    await dynamicImport(path).then(() => {}, () => {});

    assert.strictEqual(global.__dynamicImportProbe, false);
  });
});
