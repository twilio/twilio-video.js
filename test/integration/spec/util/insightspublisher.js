'use strict';

const assert = require('assert');

const InsightsPublisher = require('../../../../lib/util/insightspublisher');

const defaults = require('../../../lib/defaults');
const getToken = require('../../../lib/token');
const { a } = require('../../../lib/util');

const tokens = new Map([
  ['expired', getToken('foo', { ttl: 60 * -1000 })],
  ['invalid', 'foo'],
  ['valid', getToken('foo') ]
]);

describe('InsightsPublisher', function() {
  this.timeout(30000);

  describe('connect', () => {
    ['expired', 'invalid', 'valid'].forEach(tokenType => {
      let publisher;

      context(`when attempted with ${a(tokenType)} ${tokenType} token`, () => {
        before(() => {
          publisher = new InsightsPublisher(tokens.get(tokenType),
            'twilio-video.js',
            '1.2.3',
            'prod',
            'us1',
            defaults);
        });

        const description = tokenType !== 'valid'
          ? 'should disconnect with an Error'
          : 'should be successful';

        const test = tokenType !== 'valid' ? async () => {
          const error = await new Promise((resolve, reject) => {
            publisher.once('connected', () => reject(new Error('Unexpected connect')));
            publisher.once('disconnected', resolve);
          });
          assert(error instanceof Error);
        } : () => new Promise((resolve, reject) => {
          publisher.once('connected', resolve);
          publisher.once('disconnected', error => reject(error || new Error('Unexpected disconnect')));
        });

        it(description, test);

        after(() => {
          publisher.disconnect();
        });
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect without any error', async () => {
      const publisher = new InsightsPublisher(tokens.get('valid'),
        'twilio-video.js',
        '1.2.3',
        'prod',
        'us1',
        defaults);

      publisher.once('connected', () => publisher.disconnect());
      const error = await new Promise(resolve => publisher.once('disconnected', resolve));
      assert(!error);
    });
  });
});
