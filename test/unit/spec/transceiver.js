'use strict';

const assert = require('assert');
const TrackTransceiver = require('../../../lib/transceiver');

describe('TrackTransceiver', () => {
  describe('constructor', () => {
    const id = 'foo';
    const kind = 'bar';
    let transceiver;

    before(() => {
      transceiver = new TrackTransceiver(id, kind);
    });

    it('should set the .id property', () => {
      assert.equal(transceiver.id, id);
    });

    it('should set the .kind property', () => {
      assert.equal(transceiver.kind, kind);
    });
  });
});
