'use strict';

const assert = require('assert');
const { join } = require('path');

const { formatSummary, parseRetries, runWithRetries } = require('../../../scripts/retry');

// Each file gets a queue of attempt results; a file with no queue passes.
function fakeRunFile(outcomes) {
  const calls = [];
  const runFile = file => {
    calls.push(file);
    const queue = outcomes[file] || [];
    return Promise.resolve(queue.length ? queue.shift() : { exitCode: 0, failures: [] });
  };
  return { calls, runFile };
}

describe('runWithRetries', () => {
  it('treats a file that passes on its rerun as a retried pass', async () => {
    const { calls, runFile } = fakeRunFile({
      'b.js': [{ exitCode: 1, failures: ['RemoteTracks > messages can be sent'] }]
    });
    const result = await runWithRetries(['a.js', 'b.js', 'c.js'], runFile, 1);
    assert.deepStrictEqual(calls, ['a.js', 'b.js', 'b.js', 'c.js']);
    assert.deepStrictEqual(result, {
      exitCode: 0,
      retried: [{ file: 'b.js', attempts: [['RemoteTracks > messages can be sent']] }],
      failed: []
    });
  });

  it('fails the run when a file fails every attempt', async () => {
    const { calls, runFile } = fakeRunFile({
      'a.js': [
        { exitCode: 1, failures: ['connect > "before all" hook for "x"'] },
        { exitCode: 1, failures: ['connect > y'] },
        { exitCode: 1, failures: ['connect > z'] }
      ]
    });
    const result = await runWithRetries(['a.js', 'b.js'], runFile, 1);
    assert.deepStrictEqual(calls, ['a.js', 'a.js', 'b.js']);
    assert.deepStrictEqual(result, {
      exitCode: 1,
      retried: [],
      failed: [{ file: 'a.js', attempts: [['connect > "before all" hook for "x"'], ['connect > y']] }]
    });
  });

  it('runs a failed file once when retries is 0', async () => {
    const { calls, runFile } = fakeRunFile({
      'a.js': [{ exitCode: 1, failures: ['a > x'] }]
    });
    const result = await runWithRetries(['a.js'], runFile, 0);
    assert.deepStrictEqual(calls, ['a.js']);
    assert.deepStrictEqual(result, {
      exitCode: 1,
      retried: [],
      failed: [{ file: 'a.js', attempts: [['a > x']] }]
    });
  });
});

describe('parseRetries', () => {
  it('reads unset or empty as 0', () => {
    assert.deepStrictEqual([undefined, ''].map(parseRetries), [0, 0]);
  });

  it('reads a non-negative integer', () => {
    assert.deepStrictEqual(['0', '2'].map(parseRetries), [0, 2]);
  });

  ['-1', 'x', '1.5', '2x'].forEach(value => {
    it(`throws for ${JSON.stringify(value)}`, () => {
      assert.throws(() => parseRetries(value), /TEST_RETRIES/);
    });
  });
});

describe('formatSummary', () => {
  const root = join(__dirname, '..', '..', '..');
  const abs = name => join(root, 'test', 'integration', 'spec', name);

  it('lists each retried and failed file with the failures of each attempt', () => {
    const summary = formatSummary({
      retried: [{ file: abs('remotetracks.js'), attempts: [['RemoteTracks > a', 'RemoteTracks > b']] }],
      failed: [{ file: abs('connect.js'), attempts: [['connect > "before all" hook for "x"'], []] }]
    });
    assert.strictEqual(summary, [
      '### E2E spec files that failed an attempt',
      '',
      'Passed on a rerun:',
      '- `test/integration/spec/remotetracks.js`',
      '  - attempt 1: RemoteTracks > a',
      '  - attempt 1: RemoteTracks > b',
      '',
      'Failed every attempt:',
      '- `test/integration/spec/connect.js`',
      '  - attempt 1: connect > "before all" hook for "x"',
      '  - attempt 2: no failed test reported',
      ''
    ].join('\n'));
  });

  it('is empty when no file failed an attempt', () => {
    assert.strictEqual(formatSummary({ retried: [], failed: [] }), '');
  });
});
