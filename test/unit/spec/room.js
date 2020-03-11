'use strict';

const assert = require('assert');
const sinon = require('sinon');

const Room = require('../../../lib/room');
const LocalParticipant = require('../../../lib/localparticipant');
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
    let track;

    beforeEach(() => {
      track = {};
      [
        new RemoteParticipantSignaling('PA000', 'foo'),
        new RemoteParticipantSignaling('PA111', 'bar')
      ].forEach(signaling.connectParticipant.bind(signaling));
      participants = { };
      room.participants.forEach(participant => {
        participants[participant.identity] = participant;
      });
    });

    it('should re-emit RemoteParticipant "participantReconnected" for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('participantReconnected', spy);

      participants.foo.emit('reconnected');
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(participants.foo));
    });

    it('should re-emit RemoteParticipant "participantReconnecting" for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('participantReconnecting', spy);

      participants.foo.emit('reconnecting');
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(participants.foo));
    });

    it('should re-emit RemoteParticipant trackDimensionsChanged for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackDimensionsChanged', spy);

      participants.foo.emit('trackDimensionsChanged', track);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(track, participants.foo));
    });

    it('should re-emit RemoteParticipant trackDisabled for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackDisabled', spy);

      participants.foo.emit('trackDisabled', track);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(track, participants.foo));
    });

    it('should re-emit RemoteParticipant trackEnabled for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackEnabled', spy);

      participants.foo.emit('trackEnabled', track);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(track, participants.foo));
    });

    it('should re-emit RemoteParticipant trackMessage for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackMessage', spy);

      const message = {};
      participants.foo.emit('trackMessage', message, track);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(message, track, participants.foo));
    });

    it('should re-emit RemoteParticipant trackPublished for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackPublished', spy);

      const publication = {};
      participants.foo.emit('trackPublished', publication);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(publication, participants.foo));
    });

    it('should re-emit RemoteParticipant trackStarted for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackStarted', spy);

      participants.foo.emit('trackStarted', track);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(track, participants.foo));
    });

    it('should re-emit RemoteParticipants trackSubscribed event for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackSubscribed', spy);

      participants.foo.emit('trackSubscribed', track);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(track, participants.foo));
    });

    it('should re-emit RemoteParticipants trackSubscriptionFailed event for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackSubscriptionFailed', spy);

      const error = {};
      const publication = {};
      participants.bar.emit('trackSubscriptionFailed', error, publication);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(error, publication, participants.bar));
    });

    it('should re-emit RemoteParticipant trackUnpublished for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackUnpublished', spy);

      const publication = {};
      participants.foo.emit('trackUnpublished', publication);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(publication, participants.foo));
    });

    it('should re-emit RemoteParticipants trackUnsubscribed event for matching RemoteParticipant only', () => {
      const spy = sinon.spy();
      room.on('trackUnsubscribed', spy);

      participants.bar.emit('trackUnsubscribed', track);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(track, participants.bar));
    });

    it('should not re-emit RemoteParticipant events if the RemoteParticipant is no longer in the room', () => {
      participants.foo.emit('disconnected');

      const spy = sinon.spy();
      room.on('trackDimensionsChanged', spy);
      room.on('trackDisabled', spy);
      room.on('trackEnabled', spy);
      room.on('trackMessage', spy);
      room.on('trackPublished', spy);
      room.on('trackStarted', spy);
      room.on('trackSubscribed', spy);
      room.on('trackSubscriptionFailed', spy);
      room.on('trackUnpublished', spy);
      room.on('trackUnsubscribed', spy);

      participants.foo.emit('trackDimensionsChanged');
      participants.foo.emit('trackDisabled');
      participants.foo.emit('trackEnabled');
      participants.foo.emit('trackMessage');
      participants.foo.emit('trackPublished');
      participants.foo.emit('trackStarted');
      participants.foo.emit('trackSubscribed');
      participants.foo.emit('trackSubscriptionFailed');
      participants.foo.emit('trackUnpublished');
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
    [
      MediaConnectionError,
      SignalingConnectionDisconnectedError
    ].forEach(ReconnectingError => {
      context(`with a ${ReconnectingError.name}`, () => {
        const error = new ReconnectingError();
        it(`should trigger the same event on the Room asynchronously with the ${ReconnectingError.name} (${error.code}, "${error.message}")`, () => {
          const reconnectingPromise = new Promise(resolve => room.once('reconnecting', error => {
            assert(error instanceof ReconnectingError);
            resolve();
          }));
          signaling.preempt('reconnecting', null, [error]);
          return reconnectingPromise;
        });
      });
    });
  });

  describe('RoomSignaling state changed to "connected"', () => {
    it('should trigger the "reconnected" event on the Room', () => {
      signaling.preempt('reconnecting');
      var connectedPromise = new Promise(resolve => room.once('reconnected', resolve));
      signaling.preempt('connected');
      return connectedPromise;
    });
  });

  describe('Object.keys', () => {
    let room;

    beforeEach(() => {
      const localParticipantSignaling = new ParticipantSignaling('PAXXX', 'client');
      const localParticipant = new LocalParticipant(localParticipantSignaling, [], { log });
      const signaling = new RoomSignaling(localParticipant, 'RM123', 'foo');
      room = new Room(localParticipant, signaling, options);
    });

    it('only returns public properties', () => {
      assert.deepEqual(Object.keys(room), [
        'dominantSpeaker',
        'isRecording',
        'localParticipant',
        'name',
        'participants',
        'sid',
        'state'
      ]);
    });
  });

  describe('#toJSON', () => {
    let room;

    beforeEach(() => {
      const localParticipantSignaling = new ParticipantSignaling('PAXXX', 'client');
      const localParticipant = new LocalParticipant(localParticipantSignaling, [], { log });
      const signaling = new RoomSignaling(localParticipant, 'RM123', 'foo');
      room = new Room(localParticipant, signaling, options);
    });

    it('only returns public properties', () => {
      assert.deepEqual(room.toJSON(), {
        dominantSpeaker: room.dominantSpeaker ? room.dominantSpeaker.toJSON() : null,
        isRecording: room.isRecording,
        localParticipant: room.localParticipant.toJSON(),
        name: room.name,
        participants: {},
        sid: room.sid,
        state: room.state
      });
    });
  });
});
