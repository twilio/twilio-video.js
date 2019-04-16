'use strict';

const assert = require('assert');

const NetworkQualityConfigurationImpl = require('../../../lib/networkqualityconfiguration');

const { combinationContext } = require('../../lib/util');

describe('NetworkQualityConfigurationImpl', () => {
  describe('constructor', () => {
    combinationContext([
      [
        [undefined, 0, 1, 2, 3, 4],
        x => `when local verbosity is ${typeof x === 'undefined' ? 'absent' : x}`
      ],
      [
        [undefined, 0, 1, 2, 3, 4],
        x => `when remote verbosity is ${typeof x === 'undefined' ? 'absent' : x}`
      ]
    ], ([local, remote]) => {
      const networkQualityConfiguration = [
        ['local', local],
        ['remote', remote]
      ].reduce((params, [prop, value]) => {
        if (typeof value !== 'undefined') {
          params[prop] = value;
        }
        return params;
      }, {});

      let networkQualityConfigurationImpl;

      before(() => {
        networkQualityConfigurationImpl = new NetworkQualityConfigurationImpl(networkQualityConfiguration);
      });

      it('should return an NetworkQualityConfigurationImpl instance', () => {
        assert(networkQualityConfigurationImpl instanceof NetworkQualityConfigurationImpl);
      });

      [
        ['local', local, 1],
        ['remote', remote, 0]
      ].forEach(([prop, value, defaultValue]) => {
        const expectedValue = typeof value === 'number' ? {
          local: { 0: 1, 1: 1, 2: 2, 3: 3, 4: 1 },
          remote: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 0 }
        }[prop][value] : defaultValue;

        it(`should set the .${prop} to ${expectedValue}`, () => {
          assert.equal(networkQualityConfigurationImpl[prop], expectedValue);
        });
      });
    });
  });

  describe('update', () => {
    const networkQualityConfiguration = {
      local: 1,
      remote: 2
    };

    combinationContext([
      [
        [undefined, 0, 1, 2, 3, 4],
        x => `when the new local verbosity is ${typeof x === 'undefined' ? 'absent' : x}`
      ],
      [
        [undefined, 0, 1, 2, 3, 4],
        x => `when the new remote verbosity is ${typeof x === 'undefined' ? 'absent' : x}`
      ]
    ], ([local, remote]) => {
      const updatedNetworkQualityConfiguration = [
        ['local', local],
        ['remote', remote]
      ].reduce((params, [prop, value]) => {
        if (typeof value !== 'undefined') {
          params[prop] = value;
        }
        return params;
      }, {});

      let networkQualityConfigurationImpl;

      before(() => {
        networkQualityConfigurationImpl = new NetworkQualityConfigurationImpl(networkQualityConfiguration);
        networkQualityConfigurationImpl.update(updatedNetworkQualityConfiguration);
      });

      [
        ['local', local],
        ['remote', remote]
      ].forEach(([prop, value]) => {
        const expectedValue = typeof value === 'number' ? {
          local: { 0: 1, 1: 1, 2: 2, 3: 3, 4: 1 },
          remote: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 0 }
        }[prop][value] : networkQualityConfiguration[prop];

        it(`should set the .${prop} to ${typeof value === 'number' ? expectedValue : 'its existing value'}`, () => {
          assert.equal(networkQualityConfigurationImpl[prop], expectedValue);
        });
      });
    });
  });
});
