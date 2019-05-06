/* eslint-disable new-cap */
'use strict';

const assert = require('assert');

const Constants = require('../../../../lib/util/constants');

describe('Constants', () => {
  describe('WS_SERVER.', () => {
    it('does not embed environment for prod', () => {
      const wsServer = Constants.WS_SERVER('prod', 'gll');
      assert.equal(wsServer, 'wss://global.vss.twilio.com/signaling');
    });

    it('embeds environment for non-prod', () => {
      const wsServer = Constants.WS_SERVER('stage', 'gll');
      assert.equal(wsServer, 'wss://global.vss.stage.twilio.com/signaling');
    });

    it('embeds region', () => {
      const wsServer = Constants.WS_SERVER('prod', 'regionFoo');
      assert.equal(wsServer, 'wss://regionFoo.vss.twilio.com/signaling');
    });

    it('maps gll to global for region', () => {
      const wsServer = Constants.WS_SERVER('anyenvironment', 'gll');
      assert.equal(wsServer, 'wss://global.vss.anyenvironment.twilio.com/signaling');
    });
  });
});
