'use strict';

const assert = require('assert');
const preflight = require('../../../lib/preflight/preflight');
describe('preflight', () => {
  describe('throws when called with invalid parameters', () => {
    [
      {
        name: 'invalid subscriber token type',
        subscriberToken: 24,
        publisherToken: 'foo',
        options: {}
      },
      {
        name: 'invalid publisher token type',
        subscriberToken: 'foo',
        publisherToken: () => {},
        options: {}
      },
      {
        name: 'invalid option type',
        subscriberToken: 'foo',
        publisherToken: 'bar',
        options: 25
      }
    ].forEach(({ name, subscriberToken, publisherToken, options }) => {
      it(name, () => {
        let err = null;
        try {
          preflight(publisherToken, subscriberToken, options);
        } catch (error) {
          err = error;
        }
        assert(err !== null, 'was expecting to throw');
      });
    });
  });

  it('returns test object', () => {
    const testObj = preflight('foo', 'bar', {});
    assert(testObj);
  });
});
