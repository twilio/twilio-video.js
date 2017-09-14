'use strict';

const assert = require('assert');
const DataTrackReceiver = require('../../../../lib/data/receiver');
const EventTarget = require('../../../../lib/eventtarget');
const { makeUUID } = require('../../../../lib/util');

describe('DataTrackReceiver', () => {
  let dataChannel;
  let dataTrackReceiver;

  beforeEach(() => {
    dataChannel = makeDataChannel();
    dataTrackReceiver = new DataTrackReceiver(dataChannel);
  });

  describe('constructor', () => {
    it('sets .id to the RTCDataChannel\'s label', () => {
      assert.equal(dataTrackReceiver.id, dataChannel.label);
    });

    it('sets .kind to "data"', () => {
      assert.equal(dataTrackReceiver.kind, 'data');
    });
  });

  describe('when the underlying RTCDataChannel raises a "message" event', () => {
    let data;

    beforeEach(() => {
      data = makeUUID();
    });

    it('the DataTrackReceiver emits a "message" event', () => {
      let actualData;
      dataTrackReceiver.once('message', data => actualData = data);
      dataChannel.dispatchEvent({ type: 'message', data });
      assert.equal(actualData, data);
    });
  });
});

function makeDataChannel() {
  const dataChannel = new EventTarget();
  dataChannel.label = makeUUID();
  return dataChannel;
}
