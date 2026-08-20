'use strict';

const assert = require('assert');
const sinon = require('sinon');
const mock = require('mock-require');

describe('test/lib/rest.js', () => {
  let restLib;
  let vendorStub;

  beforeEach(() => {
    vendorStub = sinon.stub();
    mock('../../lib/vendor', vendorStub);
    delete require.cache[require.resolve('../../lib/rest')];
    // eslint-disable-next-line global-require
    restLib = require('../../lib/rest');
  });

  afterEach(() => {
    mock.stopAll();
    delete require.cache[require.resolve('../../lib/rest')];
  });

  describe('createRoom', () => {
    it('resolves with the sid when the vendor reports an in-progress Room', async () => {
      vendorStub.resolves({ sid: 'RMxxx', status: 'in-progress' });
      const sid = await restLib.createRoom('my-room', 'group-small', { MaxParticipants: 4 });
      assert.equal(sid, 'RMxxx');
      const [action, params] = vendorStub.firstCall.args;
      assert.equal(action, 'create-room');
      assert.deepStrictEqual(params, {
        name: 'my-room',
        type: 'group-small',
        roomOptions: { MaxParticipants: 4 }
      });
    });

    it('throws when the vendor does not report an in-progress Room', async () => {
      vendorStub.resolves({ sid: 'RMxxx', status: 'failed' });
      await assert.rejects(
        restLib.createRoom('my-room', 'group-small'),
        /Could not create group-small Room: my-room/
      );
    });
  });

  describe('completeRoom', () => {
    it('calls the vendor with the complete-room action', async () => {
      vendorStub.resolves({});
      await restLib.completeRoom('RMxxx');
      const [action, params] = vendorStub.firstCall.args;
      assert.equal(action, 'complete-room');
      assert.deepStrictEqual(params, { nameOrSid: 'RMxxx' });
    });
  });

  describe('getRoom', () => {
    it('calls the vendor with the get-room action and returns its result', async () => {
      vendorStub.resolves({ sid: 'RMxxx', status: 'in-progress' });
      const room = await restLib.getRoom('RMxxx');
      assert.deepStrictEqual(room, { sid: 'RMxxx', status: 'in-progress' });
      const [action, params] = vendorStub.firstCall.args;
      assert.equal(action, 'get-room');
      assert.deepStrictEqual(params, { roomSid: 'RMxxx' });
    });
  });

  describe('subscribeTrack / unsubscribeTrack', () => {
    const publication = { trackSid: 'MTxxx' };
    const room = { sid: 'RMxxx', localParticipant: { sid: 'PAxxx' } };

    it('subscribeTrack calls the vendor with the subscribe-track action', async () => {
      vendorStub.resolves({});
      await restLib.subscribeTrack(publication, room);
      const [action, params] = vendorStub.firstCall.args;
      assert.equal(action, 'subscribe-track');
      assert.deepStrictEqual(params, {
        roomSid: 'RMxxx',
        participantSid: 'PAxxx',
        trackSid: 'MTxxx'
      });
    });

    it('unsubscribeTrack calls the vendor with the unsubscribe-track action', async () => {
      vendorStub.resolves({});
      await restLib.unsubscribeTrack(publication, room);
      const [action] = vendorStub.firstCall.args;
      assert.equal(action, 'unsubscribe-track');
    });
  });

  describe('startRecording / stopRecording', () => {
    const room = { sid: 'RMxxx' };

    it('startRecording calls the vendor with the start-recording action', async () => {
      vendorStub.resolves({});
      await restLib.startRecording(room);
      const [action, params] = vendorStub.firstCall.args;
      assert.equal(action, 'start-recording');
      assert.deepStrictEqual(params, { roomSid: 'RMxxx' });
    });

    it('stopRecording calls the vendor with the stop-recording action', async () => {
      vendorStub.resolves({});
      await restLib.stopRecording(room);
      const [action] = vendorStub.firstCall.args;
      assert.equal(action, 'stop-recording');
    });
  });
});
