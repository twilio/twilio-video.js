import assert from 'assert';
import { makeStat } from '../../../lib/preflight/makestat';

describe('makestat', () => {
  it('returns null for empty array', () => {
    const stat = makeStat([]);
    assert.deepStrictEqual(stat, null);
  });

  it('returns stat for single value', () => {
    const stat = makeStat([1]);
    assert.deepStrictEqual(stat.min, 1);
    assert.deepStrictEqual(stat.max, 1);
    assert.deepStrictEqual(stat.average, 1);
  });

  it('returns stat for multiple values', () => {
    const stat = makeStat([1, 2, 3]);
    assert.deepStrictEqual(stat.min, 1);
    assert.deepStrictEqual(stat.max, 3);
    assert.deepStrictEqual(stat.average, 2);
  });
});
