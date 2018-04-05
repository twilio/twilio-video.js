'use strict';

const assert = require('assert');
const sinon = require('sinon');

const Room = require('../../../lib/room');
const ParticipantSignaling = require('../../../lib/signaling/participant');
const RemoteParticipantSignaling = require('../../../lib/signaling/remoteparticipant');
const RoomSignaling = require('../../../lib/signaling/room');

const {
  MediaConnectionError,
  SignalingConnectionDisconnectedError
} = require('../../../lib/util/twilio-video-errors');

const log = require('../../lib/fakelog');

describe('Room', () => {
  const options = { log: log };
  const localParticipant = new ParticipantSignaling('PAXXX', 'client');

  let room;
  let signaling;

  beforeEach(() => {
    signaling = new RoomSignaling(localParticipant, 'RM123', 'foo');
    room = new Room(localParticipant, signaling, options);
  });

  describe('#disconnect()', () => {
    it('should return the Room', () => {
      assert.equal(room, room.disconnect());
    });

    [
      'connected',
      'reconnecting',
      'disconnected'
    ].forEach(state => {
      describe(`called in state "${state}"`, () => {
        if (state === 'disconnected') {
          it('should not trigger a "disconnected" event on the Room', () => {
            const spy = sinon.spy();
            room.disconnect();
            room.on('disconnected', spy);
            room.disconnect();
            assert.equal(spy.callCount, 0);
          });
          return;
        }

        it('should trigger "disconnected" event on the Room with the Room as the argument', () => {
          if (state === 'reconnecting') {
            signaling.preempt('reconnecting');
          }
          const spy = sinon.spy();
          room.on('disconnected', spy);
          room.disconnect();
          assert.equal(spy.callCount, 1);
          assert.equal(spy.args[0][0], room);
        });
      });
    });
  });

  describe('RemoteParticipant events', () => {
    let participants;

    beforeEach(() => {
      [
        new RemoteParticipantSignaling('PA000', 'foo'),
        new RemoteParticipantSignaling('PA111', 'bar')
      ].forEach(signaling.connectParticipant.bind(signaling));
      participants = { };
      room.participants.forEach(participant => {
        participants[participant.identity] = participant;
      });
    });

    it('should re-emit RemoteParticipants trackAdded event for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackAdded', spy);

      participants.foo.emit('trackAdded');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipant trackDimensionsChanged for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackDimensionsChanged', spy);

      participants.foo.emit('trackDimensionsChanged');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipant trackDisabled for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackDisabled', spy);

      participants.foo.emit('trackDisabled');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipant trackEnabled for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackEnabled', spy);

      participants.foo.emit('trackEnabled');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipant trackMessage for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackMessage', spy);

      participants.foo.emit('trackMessage');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipants trackRemoved event for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackRemoved', spy);

      participants.bar.emit('trackRemoved');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipant trackStarted for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackStarted', spy);

      participants.foo.emit('trackStarted');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipants trackSubscribed event for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackSubscribed', spy);

      participants.foo.emit('trackSubscribed');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipants trackSubscriptionFailed event for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackSubscriptionFailed', spy);

      participants.bar.emit('trackSubscriptionFailed');
      assert.equal(spy.callCount, 1);
    });

    it('should re-emit RemoteParticipants trackUnsubscribed event for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackUnsubscribed', spy);

      participants.bar.emit('trackUnsubscribed');
      assert.equal(spy.callCount, 1);
    });

    it('should not re-emit RemoteParticipant events if the RemoteParticipant is no longer in the room', () => {
      participants.foo.emit('disconnected');

      const spy = sinon.spy();
      room.on('trackAdded', spy);
      room.on('trackDimensionsChanged', spy);
      room.on('trackDisabled', spy);
      room.on('trackEnabled', spy);
      room.on('trackMessage', spy);
      room.on('trackRemoved', spy);
      room.on('trackStarted', spy);
      room.on('trackSubscribed', spy);
      room.on('trackSubscriptionFailed', spy);
      room.on('trackUnsubscribed', spy);

      participants.foo.emit('trackAdded');
      participants.foo.emit('trackDimensionsChanged');
      participants.foo.emit('trackDisabled');
      participants.foo.emit('trackEnabled');
      participants.foo.emit('trackMessage');
      participants.foo.emit('trackRemoved');
      participants.foo.emit('trackStarted');
      participants.foo.emit('trackSubscribed');
      participants.foo.emit('trackSubscriptionFailed');
      participants.foo.emit('trackUnsubscribed');
      assert.equal(spy.callCount, 0);
    });
  });

  describe('RoomSignaling state changed to "disconnected"', () => {
    context('when triggered due to unexpected connection loss', () => {
      it('should trigger the same event on the Room with itself and a SignalingConnectionDisconnectedError as the arguments', () => {
        const spy = sinon.spy();
        room.on('disconnected', spy);
        signaling.preempt('disconnected', null, [new SignalingConnectionDisconnectedError()]);
        assert.equal(spy.callCount, 1);
        assert.equal(spy.args[0][0], room);
        assert(spy.args[0][1] instanceof SignalingConnectionDisconnectedError);
        assert.equal(spy.args[0][1].code, 53001);
      });
    });

    it('should unsubscribe all the RemoteParticipants\' RemoteTracks', () => {
      [
        new RemoteParticipantSignaling('PA000', 'foo'),
        new RemoteParticipantSignaling('PA111', 'bar')
      ].forEach(signaling.connectParticipant.bind(signaling));

      const participants = {};
      room.participants.forEach(participant => {
        participant._unsubscribeTracks = sinon.spy();
        participants[participant.identity] = participant;
      });
      signaling.preempt('disconnected');
      sinon.assert.calledOnce(participants.foo._unsubscribeTracks);
      sinon.assert.calledOnce(participants.bar._unsubscribeTracks);
    });
  });

  describe('RoomSignaling state changed to "reconnecting"', () => {
    it('should trigger the same event on the Room with a TwilioError 53405, "Media Connection Failed"', () => {
      const spy = sinon.spy();
      room.on('reconnecting', spy);
      signaling.preempt('reconnecting');
      assert.equal(spy.callCount, 1);
      assert(spy.args[0][0] instanceof MediaConnectionError);
      assert.equal(spy.args[0][0].code, 53405);
      assert.equal(room.state, 'reconnecting');
    });
  });

  describe('RoomSignaling state changed to "connected"', () => {
    it('should trigger the "reconnected" event on the Room', () => {
      signaling.preempt('reconnecting');
      const spy = sinon.spy();
      room.on('reconnected', spy);
      signaling.preempt('connected');
      assert.equal(spy.callCount, 1);
      assert.equal(room.state, 'connected');
    });
  });
});
