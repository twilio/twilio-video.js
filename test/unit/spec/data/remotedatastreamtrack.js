'use strict';

const assert = require('assert');
const RemoteDataStreamTrack = require('../../../../lib/data/remotedatastreamtrack');
const EventTarget = require('../../../../lib/eventtarget');
const { makeUUID } = require('../../../../lib/util');

describe('RemoteDataStreamTrack', () => {
  let dataChannel;
  let remoteDataStreamTrack;

  beforeEach(() => {
    dataChannel = makeDataChannel();
    remoteDataStreamTrack = new RemoteDataStreamTrack(dataChannel);
  });

  describe('constructor', () => {
    it('sets .id to the RTCDataChannel\'s label', () => {
      assert.equal(remoteDataStreamTrack.id, dataChannel.label);
    });

    it('sets .kind to "data"', () => {
      assert.equal(remoteDataStreamTrack.kind, 'data');
    });
  });

  describe('when the underlying RTCDataChannel raises a "message" event', () => {
    let data;

    beforeEach(() => {
      data = makeUUID();
    });

    it('the RemoteDataStreamTrack emits a "message" event', () => {
      let actualData;
      remoteDataStreamTrack.once('message', data => actualData = data);
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
