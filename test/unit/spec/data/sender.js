'use strict';

const assert = require('assert');
const sinon = require('sinon');
const DataTrackSender = require('../../../../lib/data/sender');
const { makeUUID } = require('../../../../lib/util');

describe('DataTrackSender', () => {
  let dataTrackSender;
  let maxPacketLifeTime;
  let maxRetransmits;
  let ordered;

  beforeEach(() => {
    maxPacketLifeTime = Math.floor(Math.random() * 1000);
    maxRetransmits = Math.floor(Math.random() * 1000);
    ordered = Math.random() > 0.5;
    dataTrackSender = new DataTrackSender(maxPacketLifeTime, maxRetransmits, ordered);
  });

  describe('constructor', () => {
    it('sets .id to a random ID', () => {
      assert.notEqual(dataTrackSender.id, (new DataTrackSender(null, null, true)).id);
    });

    it('sets .kind to "data"', () => {
      assert.equal(dataTrackSender.kind, 'data');
    });

    it('sets .maxPacketLifeTime to whatever value was passed in', () => {
      assert.equal(dataTrackSender.maxPacketLifeTime, maxPacketLifeTime);
    });

    it('sets .maxRetransmits to whatever value was passed in', () => {
      assert.equal(dataTrackSender.maxRetransmits, maxRetransmits);
    });

    it('sets .ordered to whatever value was passed in', () => {
      assert.equal(dataTrackSender.ordered, ordered);
    });
  });

  describe('#addDataChannel, called with an RTCDataChannel that has', () => {
    let dataChannel;

    beforeEach(() => {
      dataChannel = makeDataChannel();
    });

    describe('never been added', () => {
      it('returns the DataTrackSender', () => {
        assert.equal(dataTrackSender.addDataChannel(dataChannel), dataTrackSender);
      });
    });

    describe('already been added', () => {
      beforeEach(() => {
        dataTrackSender.addDataChannel(dataChannel);
      });

      it('returns the DataTrackSender', () => {
        assert.equal(dataTrackSender.addDataChannel(dataChannel), dataTrackSender);
      });
    });

    describe('been removed', () => {
      beforeEach(() => {
        dataTrackSender.removeDataChannel(dataChannel);
      });

      it('returns the DataTrackSender', () => {
        assert.equal(dataTrackSender.addDataChannel(dataChannel), dataTrackSender);
      });
    });
  });

  describe('#removeDataChannel, called with an RTCDataChannel that has', () => {
    let dataChannel;

    beforeEach(() => {
      dataChannel = makeDataChannel();
    });

    describe('never been added', () => {
      it('returns the DataTrackSender', () => {
        assert.equal(dataTrackSender.removeDataChannel(dataChannel), dataTrackSender);
      });
    });

    describe('been added', () => {
      beforeEach(() => {
        dataTrackSender.addDataChannel(dataChannel);
      });

      it('returns the DataTrackSender', () => {
        assert.equal(dataTrackSender.removeDataChannel(dataChannel), dataTrackSender);
      });
    });

    describe('been removed', () => {
      beforeEach(() => {
        dataTrackSender.addDataChannel(dataChannel);
        dataTrackSender.removeDataChannel(dataChannel);
      });

      it('returns the DataTrackSender', () => {
        assert.equal(dataTrackSender.removeDataChannel(dataChannel), dataTrackSender);
      });
    });
  });

  describe('#send', () => {
    let data;
    let dataChannel1;
    let dataChannel2;
    let dataChannel3;

    beforeEach(() => {
      data = makeUUID();
      dataChannel1 = makeDataChannel();
      dataChannel2 = makeDataChannel();
      dataChannel3 = makeDataChannel();
      dataTrackSender.addDataChannel(dataChannel1);
      dataTrackSender.addDataChannel(dataChannel2);
      dataTrackSender.addDataChannel(dataChannel3);
    });

    it('calls send on the added RTCDataChannels', () => {
      dataTrackSender.send(data);
      [dataChannel1, dataChannel2, dataChannel3].forEach(dataChannel => {
        sinon.assert.calledOnce(dataChannel.send);
        sinon.assert.calledWith(dataChannel.send, data);
      });
    });

    describe('calls send on the added RTCDataChannels, and, if any of those calls to send throws', () => {
      it('continues calling send on the remaining RTCDataChannels', () => {
        dataChannel1.send = sinon.spy(() => { throw new Error() });
        dataTrackSender.send(data);
        [dataChannel1, dataChannel2, dataChannel3].forEach(dataChannel => {
          sinon.assert.calledOnce(dataChannel.send);
          sinon.assert.calledWith(dataChannel.send, data);
        });
      });
    });

    it('does not call send on removed RTCDataChannels', () => {
      dataTrackSender.removeDataChannel(dataChannel1);
      dataTrackSender.send(data);
      sinon.assert.notCalled(dataChannel1.send);
      [dataChannel2, dataChannel3].forEach(dataChannel => {
        sinon.assert.calledOnce(dataChannel.send);
        sinon.assert.calledWith(dataChannel.send, data);
      });
    });
  });
});

function makeDataChannel() {
  return {
    send: sinon.spy(() => {})
  };
}
