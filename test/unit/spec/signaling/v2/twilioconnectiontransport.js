'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const { name, version } = require('../../../../../package.json');
const TwilioConnectionTransport = require('../../../../../lib/signaling/v2/twilioconnectiontransport');
const { SignalingConnectionError } = require('../../../../../lib/util/twilio-video-errors');
const TwilioError = require('../../../../../lib/util/twilioerror');

describe('TwilioConnectionTransport', () => {
  describe('constructor', () => {
    let test;

    beforeEach(() => {
      test = makeTest();
      test.open();
    });

    it('should set the .state to "connecting"', () => {
      assert.equal('connecting', test.transport.state);
    });

    it('should call .sendMessage on the underlying TwilioConnection with a Connect RSP message', () => {
      const message = test.twilioConnection.sendMessage.args[0][0];
      assert.equal(message.name, test.name);
      assert.equal(message.participant, test.localParticipantState);
      assert.deepEqual(message.peer_connections, test.peerConnectionManager.getStates());
      assert.equal(message.token, test.accessToken);
      assert.equal(message.type, 'connect');
      assert.equal(message.version, 1);
      assert.equal(message.publisher.name, `${name}.js`);
      assert.equal(message.publisher.sdk_version, version);
      assert.equal(typeof message.publisher.user_agent, 'string');
    });
  });

  describe('#disconnect, called when the Transport\'s .state is', () => {
    let test;
    let ret;

    context('"connected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.connect();
        ret = test.transport.disconnect();
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should transition to .state "disconnected"', () => {
        assert.deepEqual([
          'connected',
          'disconnected'
        ], test.transitions);
      });

      it('should call .sendMessage on the underlying TwilioConnection with a Disconnect RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          type: 'disconnect',
          version: 1
        });
      });

      it('should call .close on the underlying TwilioConnection', () => {
        sinon.assert.calledOnce(test.twilioConnection.close);
      });

      it('should call .disconnect() on the underlying ._eventPublisher', () => {
        sinon.assert.calledOnce(test.eventPublisher.disconnect);
      });
    });

    context('"connecting"', () => {
      beforeEach(() => {
        test = makeTest();
        ret = test.transport.disconnect();
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should transition to .state "disconnected"', () => {
        assert.deepEqual([
          'disconnected'
        ], test.transitions);
      });

      it('should call .sendMessage on the underlying TwilioConnection with a Disconnect RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          type: 'disconnect',
          version: 1
        });
      });

      it('should call .close on the underlying TwilioConnection', () => {
        sinon.assert.calledOnce(test.twilioConnection.close);
      });

      it('should call .disconnect() on the underlying ._eventPublisher', () => {
        sinon.assert.calledOnce(test.eventPublisher.disconnect);
      });
    });

    context('"disconnected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.transport.disconnect();
        ret = test.transport.disconnect();
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not transition .state', () => {
        assert.deepEqual([
          'disconnected'
        ], test.transitions);
      });

      it('should not call .close on the underlying TwilioConnection', () => {
        assert(!test.twilioConnection.close.calledTwice);
      });

      it('should not call .disconnect() on the underlying ._eventPublisher', () => {
        sinon.assert.calledOnce(test.eventPublisher.disconnect);
      });
    });

    context('"syncing"', () => {
      beforeEach(() => {
        test = makeTest();
        test.connect();
        test.transport.sync();
        ret = test.transport.disconnect();
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should transition to .state "disconnected"', () => {
        assert.deepEqual([
          'connected',
          'syncing',
          'disconnected'
        ], test.transitions);
      });

      it('should call .sendMessage on the underlying TwilioConnection with a Disconnect RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          type: 'disconnect',
          version: 1
        });
      });

      it('should call .close on the underlying TwilioConnection', () => {
        sinon.assert.calledOnce(test.twilioConnection.close);
      });

      it('should call .disconnect() on the underlying ._eventPublisher', () => {
        sinon.assert.calledOnce(test.eventPublisher.disconnect);
      });
    });
  });

  describe('#publish, called when the Transport\'s .state is', () => {
    let test;
    let ret;

    // NOTE(mroberts): These are used to test .publish in the "connecting" and
    // "syncing" states below.
    const extraPublishes = [
      {
        participant: {
          revision: 1,
          tracks: []
        },
        // eslint-disable-next-line camelcase
        peer_connections: [
          {
            id: 'a',
            description: {
              revision: 1,
              type: 'alpha'
            },
            ice: {
              candidates: [
                { candidate: 'candidate1' },
                { candidate: 'candidate2' }
              ],
              revision: 2
            }
          }
        ]
      },
      {
        participant: {
          revision: 2,
          tracks: [
            { fizz: 'buzz' }
          ]
        },
        // eslint-disable-next-line camelcase
        peer_connections: [
          {
            id: 'a',
            description: {
              revision: 2,
              type: 'beta'
            },
            ice: {
              candidates: [
                { candidate: 'candidate1' }
              ],
              revision: 1
            }
          },
          {
            id: 'b',
            description: {
              revision: 1,
              type: 'gamma'
            }
          },
          {
            id: 'c'
          }
        ]
      },
    ];

    const expectedPublish = {
      participant: {
        revision: 2,
        tracks: [
          { fizz: 'buzz' }
        ]
      },
      // eslint-disable-next-line camelcase
      peer_connections: [
        {
          id: 'a',
          description: {
            revision: 2,
            type: 'beta'
          },
          ice: {
            candidates: [
              { candidate: 'candidate1' },
              { candidate: 'candidate2' }
            ],
            revision: 2
          }
        },
        {
          id: 'b',
          description: {
            revision: 1,
            type: 'gamma'
          }
        },
        {
          id: 'c'
        }
      ],
      type: 'update',
      version: 1
    };

    context('"connected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.open();
        test.connect();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should call .sendMessage on the underlying TwilioConnection with an Update RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          foo: 'bar',
          session: test.transport._session,
          type: 'update',
          version: 1
        });
      });
    });

    context('"connecting"', () => {
      beforeEach(() => {
        test = makeTest();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should enqueue the Update RSP message', () => {
        assert.deepEqual(test.transport._updatesToSend[0], { foo: 'bar' });
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.notCalled(test.twilioConnection.sendMessage);
      });

      context('when the .state transitions to', () => {
        beforeEach(() => {
          extraPublishes.forEach(test.transport.publish, test.transport);
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.open();
            test.connect();
          });

          it('should call .sendMessage on the underlying TwilioConnection with the reduced Update RSP message', () => {
            sinon.assert.calledWith(test.twilioConnection.sendMessage, Object.assign({
              session: test.transport._session
            }, expectedPublish));
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.transport.disconnect();
          });

          it('should not call .sendMessage on the TwilioConnection with the reduced Update RSP message', () => {
            sinon.assert.callCount(test.twilioConnection.sendMessage, 1);
          });
        });
      });
    });

    context('"disconnected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.transport.disconnect();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.callCount(test.twilioConnection.sendMessage, 1);
      });
    });

    context('"syncing"', () => {
      beforeEach(() => {
        test = makeTest();
        test.open();
        test.connect();
        test.transport.sync();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should enqueue the Update RSP message', () => {
        assert.deepEqual(test.transport._updatesToSend[0], { foo: 'bar' });
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.callCount(test.twilioConnection.sendMessage, 2);
      });

      context('when the .state transitions to', () => {
        beforeEach(() => {
          extraPublishes.forEach(test.transport.publish, test.transport);
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.sync();
          });

          it('should call .sendMessage on the underlying TwilioConnection with the reduced Update RSP message', () => {
            sinon.assert.calledWith(test.twilioConnection.sendMessage, Object.assign({
              session: test.transport._session
            }, expectedPublish));
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.transport.disconnect();
          });

          it('should not call .sendMessage on the TwilioConnection with the reduced Update RSP message', () => {
            sinon.assert.callCount(test.twilioConnection.sendMessage, 3);
          });
        });
      });
    });
  });

  describe('#publishEvent', () => {
    let test;
    let ret;

    before(() => {
      test = makeTest();
      test.connect();
      ret = test.transport.publishEvent('foo', 'bar', { baz: 1 });
    });

    it('should call .publish() on the underlying ._eventPublisher', () => {
      sinon.assert.calledWith(test.eventPublisher.publish, 'foo', 'bar', { baz: 1 });
    });

    it('should return the value returned by calling .publish() on the underlying ._eventPublisher', () => {
      assert.equal(ret, 'baz');
    });
  });

  describe('#sync, called when the Transport\'s .state is', () => {
    let test;
    let ret;

    context('"connected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.open();
        test.connect();
        ret = test.transport.sync();
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should transition to .state "syncing"', () => {
        assert.deepEqual([
          'connected',
          'syncing'
        ], test.transitions);
      });

      it('should call .sendMessage on the underlying TwilioConnection with a Sync RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          name: test.name,
          participant: test.localParticipantState,
          // eslint-disable-next-line
          peer_connections: test.peerConnectionManager.getStates(),
          session: test.transport._session,
          token: test.accessToken,
          type: 'sync',
          version: 1
        });
      });
    });

    context('"connecting"', () => {
      beforeEach(() => {
        test = makeTest();
        ret = test.transport.sync();
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not transition .state', () => {
        assert.deepEqual([
        ], test.transitions);
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.notCalled(test.twilioConnection.sendMessage);
      });
    });

    context('"disconnected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.transport.disconnect();
        ret = test.transport.sync();
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not transition .state', () => {
        assert.deepEqual([
          'disconnected'
        ], test.transitions);
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.callCount(test.twilioConnection.sendMessage, 1);
      });
    });

    context('"syncing"', () => {
      beforeEach(() => {
        test = makeTest();
        test.open();
        test.connect();
        test.transport.sync();
        ret = test.transport.sync();
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not transition .state', () => {
        assert.deepEqual([
          'connected',
          'syncing'
        ], test.transitions);
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.callCount(test.twilioConnection.sendMessage, 2);
      });
    });
  });

  describe('the underlying TwilioConnection emits', () => {
    let test;

    beforeEach(() => {
      test = makeTest();
    });

    context('a "close" event, and the Transport\'s .state is', () => {
      context('"connected"', () => {
        let connectedOrMessageEventEmitted;
        let disconnectedError;

        beforeEach(() => {
          test.open();
          test.connect();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('stateChanged', (state, error) => {
            disconnectedError = error;
          });
          test.twilioConnection.close(new Error('foo'));
        });

        it('should transition .state to "disconnected"', () => {
          assert.deepEqual([
            'connected',
            'disconnected'
          ], test.transitions);
          assert(disconnectedError instanceof SignalingConnectionError);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });
      });

      context('"connecting"', () => {
        let connectedOrMessageEventEmitted;
        let disconnectedError;

        beforeEach(() => {
          test.open();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('stateChanged', (state, error) => {
            disconnectedError = error;
          });
          test.twilioConnection.close(new Error('foo'));
        });

        it('should transition .state to "disconnected"', () => {
          assert.deepEqual([
            'disconnected'
          ], test.transitions);
          assert(disconnectedError instanceof SignalingConnectionError);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });
      });

      context('"disconnected"', () => {
        let connectedOrMessageEventEmitted;
        let disconnectedError;

        beforeEach(() => {
          test.open();
          test.connect();
          test.transport.disconnect();

          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('stateChanged', (state, error) => {
            disconnectedError = error;
          });
          test.twilioConnection.close(new Error('foo'));
        });

        it('should do nothing"', () => {
          assert.deepEqual([
            'connected',
            'disconnected'
          ], test.transitions);
          assert(!disconnectedError);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });
      });

      context('"syncing"', () => {
        let connectedOrMessageEventEmitted;
        let disconnectedError;

        beforeEach(() => {
          test.open();
          test.connect();
          test.transport.sync();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('stateChanged', (state, error) => {
            disconnectedError = error;
          });
          test.twilioConnection.close(new Error('foo'));
        });

        it('should transition .state to "disconnected"', () => {
          assert.deepEqual([
            'connected',
            'syncing',
            'disconnected'
          ], test.transitions);
          assert(disconnectedError instanceof SignalingConnectionError);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });
      });
    });

    context('an "open" event, and the Transport\'s .state is', () => {
      context('"connected"', () => {
        let connectedOrMessageEventEmitted;

        beforeEach(() => {
          test.open();
          test.connect();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.open();
        });

        it('should not transition .state', () => {
          assert.deepEqual([
            'connected'
          ], test.transitions);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });

        it('should not call .sendMessage on the underlying TwilioConnection with a Connect RSP message', () => {
          sinon.assert.callCount(test.twilioConnection.sendMessage, 1);
        });
      });

      context('"connecting"', () => {
        let connectedOrMessageEventEmitted;

        beforeEach(() => {
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.open();
        });

        it('should not transition .state', () => {
          assert.deepEqual([], test.transitions);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });

        it('should call .sendMessage on the underlying TwilioConnection with a Connect RSP message', () => {
          const message = test.twilioConnection.sendMessage.args[0][0];
          assert.equal(message.name, test.name);
          assert.equal(message.participant, test.localParticipantState);
          assert.deepEqual(message.peer_connections, test.peerConnectionManager.getStates());
          assert.equal(message.token, test.accessToken);
          assert.equal(message.type, 'connect');
          assert.equal(message.version, 1);
          assert.equal(message.publisher.name, `${name}.js`);
          assert.equal(message.publisher.sdk_version, version);
          assert.equal(typeof message.publisher.user_agent, 'string');
        });
      });

      context('"disconnected"', () => {
        let connectedOrMessageEventEmitted;

        beforeEach(() => {
          test.transport.disconnect();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.open();
        });

        it('should not transition .state', () => {
          assert.deepEqual([
            'disconnected'
          ], test.transitions);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });

        it('should call .sendMessage on the underlying TwilioConnection with a Disconnect RSP message', () => {
          sinon.assert.calledWith(test.twilioConnection.sendMessage, {
            type: 'disconnect',
            version: 1
          });
        });
      });

      context('"syncing"', () => {
        let connectedOrMessageEventEmitted;

        beforeEach(() => {
          test.open();
          test.connect();
          test.transport.sync();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.open();
        });

        it('should not transition .state', () => {
          assert.deepEqual([
            'connected',
            'syncing'
          ], test.transitions);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });

        it('should call .sendMessage on the underlying TwilioConnection with a Sync RSP message', () => {
          sinon.assert.calledWith(test.twilioConnection.sendMessage, {
            name: test.name,
            participant: test.localParticipantState,
            // eslint-disable-next-line
            peer_connections: test.peerConnectionManager.getStates(),
            session: test.transport._session,
            token: test.accessToken,
            type: 'sync',
            version: 1
          });
        });
      });
    });

    context('a "message" event, and the Transport\'s .state is', () => {
      context('"connected", and the message\'s .type is', () => {
        let test;

        beforeEach(() => {
          test = makeTest();
          test.open();
          test.connect();
          test.transitions = [];
        });

        [
          { session: 'foo', type: 'connected' },
          { type: 'synced' },
          { type: 'update' }
        ].forEach(expectedMessage => {
          context(`"${expectedMessage.type}"`, () => {
            let connected;
            let message;

            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.once('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage(expectedMessage);
            });

            it('should not transition .state', () => {
              assert.deepEqual(test.transitions, []);
            });

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should emit "message"', () => {
              assert.deepEqual(message, expectedMessage);
            });
          });
        });

        context('"disconnected"', () => {
          let connected;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({ type: 'disconnected' });
          });

          it('should transition .state to "disconnected"', () => {
            assert.deepEqual(test.transitions, [
              'disconnected'
            ]);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should not emit "message"', () => {
            assert(!message);
          });
        });

        context('"error"', () => {
          let connected;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({
              code: 1000,
              message: 'foo',
              type: 'error'
            });
          });

          it('should not transition .state', () => {
            assert(test.transitions, []);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should not emit "message"', () => {
            assert(!message);
          });
        });
      });

      context('"connecting", and the message\'s .type is', () => {
        let test;

        beforeEach(() => {
          test = makeTest();
          test.open();
        });

        context('"connected"', () => {
          let connected;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({
              session: 'foo',
              type: 'connected'
            });
          });

          it('should transition .state to "connected"', () => {
            assert.deepEqual(test.transitions, [
              'connected'
            ]);
          });

          it('should emit "connected"', () => {
            assert.deepEqual(connected, {
              session: 'foo',
              type: 'connected'
            });
          });

          it('should not emit "message"', () => {
            assert(!message);
          });
        });

        context('"disconnected"', () => {
          let connected;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({ type: 'disconnected' });
          });

          it('should transition .state to "disconnected"', () => {
            assert.deepEqual(test.transitions, [
              'disconnected'
            ]);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should not emit "message"', () => {
            assert(!message);
          });
        });

        context('"error"', () => {
          [
            { code: 1000, message: 'foo', type: 'error' },
            { type: 'error' }
          ].forEach(errorMessage => {
            const expectedCode = errorMessage.code || 0;
            const expectedMessage = errorMessage.message || 'Unknown error';
            context(expectedCode ? 'with .code and .message' : 'without .code or .message', () => {
              let connected;
              let error;
              let message;

              beforeEach(() => {
                test.transport.once('connected', msg => {
                  connected = msg;
                });
                test.transport.once('message', msg => {
                  message = msg;
                });
                test.transport.once('stateChanged', (state, err) => {
                  error = err;
                });
                test.twilioConnection.receiveMessage(errorMessage);
              });

              it(`should transition .state to "disconnected" with a TwilioError (code=${expectedCode}, message="${expectedMessage}")`, () => {
                assert.deepEqual(test.transitions, [
                  'disconnected'
                ]);
                assert(error instanceof TwilioError);
                assert.equal(error.code, expectedCode);
                assert.equal(error.message, expectedMessage);
              });

              it('should not emit "connected"', () => {
                assert(!connected);
              });

              it('should not emit "message"', () => {
                assert(!message);
              });
            });
          });
        });

        ['synced', 'update'].forEach(type => {
          context(`"${type}"`, () => {
            let connected;
            let message;

            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.once('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage({ type });
            });

            it('should not transition .state', () => {
              assert.deepEqual(test.transitions, []);
            });

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should not emit "message"', () => {
              assert(!message);
            });

            context('after transition to .state "connected"', () => {
              beforeEach(() => {
                test.connect();
              });

              it('should emit "message"', () => {
                assert.deepEqual(message, { type });
              });
            });
          });
        });
      });

      context('"disconnected", and the message\'s .type is', () => {
        let test;

        beforeEach(() => {
          test = makeTest();
          test.open();
          test.connect();
          test.transport.disconnect();
          test.transitions = [];
        });

        [
          { session: 'foo', type: 'connected' },
          { type: 'disconnected' },
          { code: 1000, message: 'foo', type: 'error' },
          { type: 'synced' },
          { type: 'update' }
        ].forEach(expectedMessage => {
          let connected;
          let message;

          context(`"${expectedMessage.type}"`, () => {
            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.once('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage(expectedMessage);
            });

            it('should not transition .state', () => {
              assert.deepEqual(test.transitions, []);
            });

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should not emit "message"', () => {
              assert(!message);
            });
          });
        });
      });

      context('"syncing", and the message\'s .type is', () => {
        let test;

        beforeEach(() => {
          test = makeTest();
          test.open();
          test.connect();
          test.transport.sync();
          test.transitions = [];
        });

        [
          { session: 'foo', type: 'connected' },
          { type: 'update' }
        ].forEach(expectedMessage => {
          context(`"${expectedMessage.type}"`, () => {
            let connected;
            let message;

            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.on('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage(expectedMessage);
            });

            it('should not transition .state', () => {
              assert.deepEqual(test.transitions, []);
            });

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should not emit "message"', () => {
              assert(!message);
            });

            context('after transition to .state "connected"', () => {
              beforeEach(() => {
                test.sync();
              });

              it('should emit "message"', () => {
                assert.deepEqual(message, expectedMessage);
              });
            });
          });
        });

        context('"disconnected"', () => {
          let connected;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({ type: 'disconnected' });
          });

          it('should transition .state to "disconnected"', () => {
            assert.deepEqual(test.transitions, [
              'disconnected'
            ]);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should not emit "message"', () => {
            assert(!message);
          });
        });

        context('"error"', () => {
          let connected;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({
              code: 1000,
              message: 'foo',
              type: 'error'
            });
          });

          it('should not transition .state', () => {
            assert(test.transitions, []);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should not emit "message"', () => {
            assert(!message);
          });

        });

        context('"synced"', () => {
          let connected;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.on('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({ type: 'synced' });
          });

          it('should transition .state to "connected"', () => {
            assert.deepEqual(test.transitions, [
              'connected'
            ]);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should emit "message"', () => {
            assert.deepEqual(message, {
              type: 'synced'
            });
          });
        });
      });
    });
  });
});

class FakeTwilioConnection extends EventEmitter {
  constructor() {
    super();
    this.close = sinon.spy(error => this.emit('close', error));
    this.open = () => this.emit('open');
    this.receiveMessage = message => this.emit('message', message);
    this.sendMessage = sinon.spy(() => {});
  }
}

function makeTest(options) {
  options = options || {};
  options.name = 'name' in options ? options.name : makeName();
  options.accessToken = options.accessToken || makeAccessToken();
  options.wsServer = options.wsServer || makeName();
  options.localParticipantState = options.localParticipantState || {
    revision: 1,
    tracks: [
      { whiz: 'bang' }
    ]
  };
  options.localParticipant = options.localParticipant || makeLocalParticipant(options);
  options.peerConnectionManager = options.peerConnectionManager || makePeerConnectionManager(options);
  options.InsightsPublisher = options.InsightsPublisher || makeInsightsPublisherConstructor(options);
  options.NullInsightsPublisher = options.NullInsightsPublisher || makeInsightsPublisherConstructor(options);
  options.TwilioConnection = options.TwilioConnection || FakeTwilioConnection;
  options.transport = options.transport || new TwilioConnectionTransport(
    options.name,
    options.accessToken,
    options.localParticipant,
    options.peerConnectionManager,
    options.wsServer,
    options);
  options.twilioConnection = options.transport._twilioConnection;
  options.transitions = [];
  options.transport.on('stateChanged', state => {
    options.transitions.push(state);
  });
  options.receiveMessage = message => options.twilioConnection.receiveMessage(message);
  options.close = error => options.twilioConnection.close(error);
  options.open = () => options.twilioConnection.open();
  options.connect = () => options.receiveMessage({ session: makeName(), type: 'connected' });
  options.sync = () => options.receiveMessage({ type: 'synced' });
  return options;
}

function makeName() {
  return Math.random().toString(36).slice(2);
}

function makeAccessToken() {
  return Math.random().toString(36).slice(2);
}

function makeLocalParticipant(options) {
  const localParticipant = {};
  localParticipant.getState = sinon.spy(() => options.localParticipantState);
  return localParticipant;
}

function makePeerConnectionManager() {
  return { getStates: () => [] };
}

function makeInsightsPublisherConstructor(testOptions) {
  return function InsightsPublisher() {
    this.disconnect = sinon.spy(() => {});
    this.publish = sinon.spy(() => 'baz');
    testOptions.eventPublisher = this;
  };
}
