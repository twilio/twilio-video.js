'use strict';

const assert = require('assert');
const sinon = require('sinon');
const LocalDataStreamTrack = require('../../../../lib/data/localdatastreamtrack');
const { makeUUID } = require('../../../../lib/util');

describe('LocalDataStreamTrack', () => {
  let localDataStreamTrack;

  beforeEach(() => {
    localDataStreamTrack = new LocalDataStreamTrack();
  });

  describe('constructor', () => {
    it('sets .id to a random ID', () => {
      assert.notEqual(localDataStreamTrack.id, (new LocalDataStreamTrack()).id);
    });

    it('sets .kind to "data"', () => {
      assert.equal(localDataStreamTrack.kind, 'data');
    });
  });

  describe('#addDataChannel, called with an RTCDataChannel that has', () => {
    let dataChannel;

    beforeEach(() => {
      dataChannel = makeDataChannel();
    });

    describe('never been added', () => {
      it('returns the LocalDataStreamTrack', () => {
        assert.equal(localDataStreamTrack.addDataChannel(dataChannel), localDataStreamTrack);
      });
    });

    describe('already been added', () => {
      beforeEach(() => {
        localDataStreamTrack.addDataChannel(dataChannel);
      });

      it('returns the LocalDataStreamTrack', () => {
        assert.equal(localDataStreamTrack.addDataChannel(dataChannel), localDataStreamTrack);
      });
    });

    describe('been removed', () => {
      beforeEach(() => {
        localDataStreamTrack.removeDataChannel(dataChannel);
      });

      it('returns the LocalDataStreamTrack', () => {
        assert.equal(localDataStreamTrack.addDataChannel(dataChannel), localDataStreamTrack);
      });
    });
  });

  describe('#removeDataChannel, called with an RTCDataChannel that has', () => {
    let dataChannel;

    beforeEach(() => {
      dataChannel = makeDataChannel();
    });

    describe('never been added', () => {
      it('returns the LocalDataStreamTrack', () => {
        assert.equal(localDataStreamTrack.removeDataChannel(dataChannel), localDataStreamTrack);
      });
    });

    describe('been added', () => {
      beforeEach(() => {
        localDataStreamTrack.addDataChannel(dataChannel);
      });

      it('returns the LocalDataStreamTrack', () => {
        assert.equal(localDataStreamTrack.removeDataChannel(dataChannel), localDataStreamTrack);
      });
    });

    describe('been removed', () => {
      beforeEach(() => {
        localDataStreamTrack.addDataChannel(dataChannel);
        localDataStreamTrack.removeDataChannel(dataChannel);
      });

      it('returns the LocalDataStreamTrack', () => {
        assert.equal(localDataStreamTrack.removeDataChannel(dataChannel), localDataStreamTrack);
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
      localDataStreamTrack.addDataChannel(dataChannel1);
      localDataStreamTrack.addDataChannel(dataChannel2);
      localDataStreamTrack.addDataChannel(dataChannel3);
    });

    it('calls send on the added RTCDataChannels', () => {
      localDataStreamTrack.send(data);
      [dataChannel1, dataChannel2, dataChannel3].forEach(dataChannel => {
        sinon.assert.calledOnce(dataChannel.send);
        sinon.assert.calledWith(dataChannel.send, data);
      });
    });

    describe('calls send on the added RTCDataChannels, and, if any of those calls to send throws', () => {
      it('continues calling send on the remaining RTCDataChannels', () => {
        dataChannel1.send = sinon.spy(() => { throw new Error() });
        localDataStreamTrack.send(data);
        [dataChannel1, dataChannel2, dataChannel3].forEach(dataChannel => {
          sinon.assert.calledOnce(dataChannel.send);
          sinon.assert.calledWith(dataChannel.send, data);
        });
      });
    });

    it('does not call send on removed RTCDataChannels', () => {
      localDataStreamTrack.removeDataChannel(dataChannel1);
      localDataStreamTrack.send(data);
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
