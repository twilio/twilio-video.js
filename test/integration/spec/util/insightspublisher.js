'use strict';

const assert = require('assert');

const InsightsPublisher = require('../../../../lib/util/insightspublisher');

const defaults = require('../../../lib/defaults');
const getToken = require('../../../lib/token');
const { a } = require('../../../lib/util');

const tokens = new Map([
  ['expired', getToken('foo', { ttl: 60 * -1000 })],
  ['invalid', 'foo'],
  ['valid', getToken('foo')]
]);

const options = Object.assign({
  environment: 'prod'
}, defaults);

if (defaults.wsServerInsights) {
  options.gateway = defaults.wsServerInsights;
}

describe('InsightsPublisher (@unstable: JSDK-2761)', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(30000);

  describe('connect', () => {
    ['valid', 'expired', 'invalid'].forEach(tokenType => {
      let publisher;

      context(`when attempted with ${a(tokenType)} ${tokenType} token`, () => {
        before(() => {
          publisher = new InsightsPublisher(tokens.get(tokenType),
            'twilio-video.js',
            '1.2.3',
            options.environment,
            'us1',
            options);
          publisher.connect('roomSid', 'participantSid');
        });

        const description = tokenType !== 'valid'
          ? 'should disconnect with an Error'
          : 'should be successful';


        const test = tokenType !== 'valid' ? async () => {
          const error = await new Promise((resolve, reject) => {
            publisher.once('connected', () => reject(new Error('Unexpected connect')));
            publisher.once('disconnected', resolve);
          });
          assert(error instanceof Error, `unexpected error ${error}`);
          if (!(error instanceof Error)) {
            // eslint-disable-next-line no-console
            console.log('Unexpected error:', error);
          }
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
        options.environment,
        'us1',
        options);

      publisher.connect('roomSid', 'participantSid');
      publisher.once('connected', () => publisher.disconnect());
      const error = await new Promise(resolve => publisher.once('disconnected', resolve));
      assert(!error);
    });
  });
});
