'use strict';

const assert = require('assert');
const { join } = require('path');

const { shardFiles } = require('../../../scripts/shard');

const root = join(__dirname, '..', '..', '..');
const abs = name => join(root, 'test', 'integration', 'spec', name);
const rel = name => `test/integration/spec/${name}`;

describe('shardFiles', () => {
  it('runs every file in exactly one shard, including a file missing from the timings', () => {
    const files = ['a.js', 'b.js', 'c.js', 'd.js', 'e.js', 'f.js', 'missing.js'].map(abs);
    const timings = { [rel('a.js')]: 300, [rel('b.js')]: 5, [rel('c.js')]: 120, [rel('d.js')]: 120, [rel('e.js')]: 60, [rel('f.js')]: 1 };
    const shards = ['1/3', '2/3', '3/3'].map(shard => shardFiles(files, shard, timings));
    shards.forEach(shard => assert(shard.length > 0, `empty shard in ${JSON.stringify(shards)}`));
    assert.deepStrictEqual([].concat(...shards).sort(), [...files].sort());
  });

  it('puts each file, longest first, into the lightest shard', () => {
    const files = ['a.js', 'b.js', 'c.js', 'd.js', 'e.js'].map(abs);
    const timings = { [rel('a.js')]: 100, [rel('b.js')]: 60, [rel('c.js')]: 50, [rel('d.js')]: 40, [rel('e.js')]: 10 };
    assert.deepStrictEqual(
      ['1/3', '2/3', '3/3'].map(shard => shardFiles(files, shard, timings)),
      [[abs('a.js')], [abs('b.js'), abs('e.js')], [abs('c.js'), abs('d.js')]]);
  });

  it('weighs a file missing from the timings as 10 seconds', () => {
    // At 10 s, m.js sorts after b.js (11 s) and before c.js (9 s): [a, c] and [b, m].
    // At 0 s it would sort last and give [a, m] and [b, c].
    const files = ['a.js', 'b.js', 'c.js', 'm.js'].map(abs);
    const timings = { [rel('a.js')]: 20, [rel('b.js')]: 11, [rel('c.js')]: 9 };
    assert.deepStrictEqual(
      ['1/2', '2/2'].map(shard => shardFiles(files, shard, timings)),
      [[abs('a.js'), abs('c.js')], [abs('b.js'), abs('m.js')]]);
  });

  [undefined, ''].forEach(shard => {
    it(`returns every file when TEST_SHARD is ${JSON.stringify(shard)}`, () => {
      const files = ['a.js', 'b.js', 'c.js'].map(abs);
      assert.deepStrictEqual(shardFiles(files, shard, { [rel('a.js')]: 100 }), files);
    });
  });

  ['0/3', '4/3', '1', 'a/b', '1/0', ' 1/3'].forEach(shard => {
    it(`throws for TEST_SHARD ${JSON.stringify(shard)}`, () => {
      assert.throws(() => shardFiles([abs('a.js')], shard, {}), /TEST_SHARD/);
    });
  });
});
