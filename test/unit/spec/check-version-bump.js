'use strict';

const assert = require('assert');

const { compare, isForward, parse } = require('../../../scripts/check-version-bump');

describe('check-version-bump', () => {
  describe('parse', () => {
    it('splits a final version', () => {
      assert.deepStrictEqual(parse('2.36.0'), { numbers: [2, 36, 0], prerelease: [] });
    });

    it('splits a dotted prerelease', () => {
      assert.deepStrictEqual(parse('2.36.0-rc.1'), { numbers: [2, 36, 0], prerelease: ['rc', '1'] });
    });

    it('splits the dotless prerelease used before 2.30', () => {
      assert.deepStrictEqual(parse('2.24.1-rc1'), { numbers: [2, 24, 1], prerelease: ['rc1'] });
    });

    [' 2.36.0', '2.36', 'v2.36.0', '2.36.0.1', 'patch', '2.36.0\n2.36.0', ''].forEach(version => {
      it(`returns null for ${JSON.stringify(version)}`, () => {
        assert.strictEqual(parse(version), null);
      });
    });
  });

  describe('compare', () => {
    it('orders a final version above its own prerelease', () => {
      assert.strictEqual(compare('2.34.0', '2.34.0-rc.5'), 1);
    });

    it('treats identical versions as equal', () => {
      assert.strictEqual(compare('2.35.0', '2.35.0'), 0);
    });

    it('orders numeric prerelease identifiers numerically, not lexically', () => {
      assert.strictEqual(compare('2.34.0-rc.10', '2.34.0-rc.9'), 1);
    });

    it('orders a numeric identifier below an alphanumeric one', () => {
      assert.strictEqual(compare('2.34.0-1', '2.34.0-alpha'), -1);
    });

    it('orders a longer identifier set above its own prefix', () => {
      assert.strictEqual(compare('2.34.0-rc.1', '2.34.0-rc'), 1);
    });

    it('throws on a version it cannot parse', () => {
      assert.throws(() => compare('2.36.0', 'patch'), /not an exact version/);
    });
  });

  // Every case below is a transition taken from this repo's git history.
  describe('isForward', () => {
    describe('allows the final release, which the branch always cuts from X.Y.Z-dev', () => {
      [
        ['2.34.0-dev', '2.34.0'],
        ['2.33.0-dev', '2.33.0'],
        ['2.32.1-dev', '2.32.1'],
        ['2.30.0-dev', '2.30.0'],
        ['2.35.1-dev', '2.35.1'],
        ['2.34.0-rc.5', '2.34.0'],
        ['2.24.1-rc1', '2.24.1']
      ].forEach(([current, next]) => {
        it(`${current} -> ${next}`, () => {
          assert.strictEqual(isForward(current, next), true);
        });
      });
    });

    describe('allows a release candidate', () => {
      [
        ['2.34.0-dev', '2.34.0-rc.1'],
        ['2.34.0-dev', '2.34.0-rc.5'],
        ['2.35.1-dev', '2.36.0-rc.1']
      ].forEach(([current, next]) => {
        it(`${current} -> ${next}`, () => {
          assert.strictEqual(isForward(current, next), true);
        });
      });
    });

    describe('rejects a version that does not move forward', () => {
      [
        // The real typo released on 2023-10-03: 2.8.2-rc1 instead of 2.28.2-rc1.
        ['2.28.2-dev', '2.8.2-rc1'],
        ['2.35.0', '2.35.0'],
        ['2.35.1-dev', '2.35.0'],
        ['2.34.0-rc.5', '2.34.0-rc.2'],
        ['2.34.0', '2.34.0-rc.6']
      ].forEach(([current, next]) => {
        it(`${current} -> ${next}`, () => {
          assert.strictEqual(isForward(current, next), false);
        });
      });
    });
  });
});
