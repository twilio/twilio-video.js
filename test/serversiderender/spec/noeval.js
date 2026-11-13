'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');

const { version } = require('../../../package.json');

describe('Loading the SDK when code generation from strings is disallowed', () => {
  it('should not throw an error', () => {
    // --disallow-code-generation-from-strings blocks eval and the Function constructor, as a
    // Content Security Policy without 'unsafe-eval' does. Setting location lets dynamicImport
    // initialize as it does in a browser.
    const script = `
      globalThis.location = 'https://localhost/';
      process.stdout.write(require(process.argv[1]).version);
    `;
    const { status, stdout, stderr } = spawnSync(process.execPath, [
      '--disallow-code-generation-from-strings',
      '-e',
      script,
      require.resolve('../../../es5/index'),
    ], { encoding: 'utf8' });

    assert.strictEqual(status, 0, stderr);
    assert.strictEqual(stdout, version);
  });
});
