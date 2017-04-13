'use strict';

const InsightsPublisher = require('../../../../lib/util/insightspublisher');
const a = require('../../../lib/util').a;
const assert = require('assert');
const credentials = require('../../../env');
const getToken = require('../../../lib/token').getToken.bind(null, credentials);
const wsServerInsights = credentials.wsServerInsights;

const options = {};
if (wsServerInsights) {
  options.gateway = wsServerInsights;
}

const tokens = new Map([
  ['expired', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzczNzE5OGZiYTEyNDc3MjkxYTQ4OWI5NDUxMDdkZWYzLTE0OTAwNTQwNjUiLCJncmFudHMiOnsiaWRlbnRpdHkiOiJiIiwidmlkZW8iOnsiY29uZmlndXJhdGlvbl9wcm9maWxlX3NpZCI6IlZTNjQ2OWU5NWYwYjJlMmM4ZjkzMTA4Njk4OGQ2OWY4MTUifX0sImlhdCI6MTQ5MDA1NDA2NSwiZXhwIjoxNDkwMDU3NjY1LCJpc3MiOiJTSzczNzE5OGZiYTEyNDc3MjkxYTQ4OWI5NDUxMDdkZWYzIiwic3ViIjoiQUNlMDQ0NmM0OGJkMjBhYjZmNjgzNDUzN2EwN2JlZGFkYiJ9.nvntolfv2Gffy5e-Kux_nUWgbjHqPJZU4TNMvTbciMc'],
  ['invalid', 'foo'],
  ['valid', getToken({ address: 'foo' }) ]
]);

describe('InsightsPublisher', () => {
  describe('connect', () => {
    [ [ 'expired', 9202 ], [ 'invalid', 9004 ], [ 'valid' ] ].forEach(scenario => {
      var publisher;
      const tokenType = scenario[0];
      const expectedErrorCode = scenario[1];

      context(`when attempted with ${a(tokenType)} ${tokenType} token`, () => {
        before(() => {
          publisher = new InsightsPublisher(tokens.get(tokenType),
            'twilio-video.js',
            '1.2.3',
            'prod',
            'us1',
            options);
        });

        const description = tokenType !== 'valid'
          ? `should disconnect with the error code ${expectedErrorCode}`
          : 'should be successful';

        const test = tokenType !== 'valid' ? async () => {
          const error = await new Promise((resolve, reject) => {
            publisher.once('connected', () => reject(new Error('Unexpected connect')));
            publisher.once('disconnected', resolve);
          });
          assert(error instanceof Error);
          assert.equal(error.code, expectedErrorCode);
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
        options);

      publisher.once('connected', () => publisher.disconnect());
      const error = await new Promise(resolve => publisher.once('disconnected', resolve));
      assert(!error);
    });
  });
});
