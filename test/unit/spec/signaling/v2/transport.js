'use strict';

var assert = require('assert');
var constants = require('../../../../../lib/util/constants');
var EventEmitter = require('events').EventEmitter;
var sinon = require('sinon');
var Transport = require('../../../../../lib/signaling/v2/transport');
var TwilioError = require('../../../../../lib/util/twilioerror');
var TwilioErrors = require('../../../../../lib/util/twilio-video-errors');
var SignalingIncomingMessageInvalidError = TwilioErrors.SignalingIncomingMessageInvalidError;
var SignalingConnectionTimeoutError = TwilioErrors.SignalingConnectionTimeoutError;
var SignalingConnectionError = TwilioErrors.SignalingConnectionError;

describe('Transport', () => {
  describe('constructor', () => {
    var test;

    beforeEach(() => {
      test = makeTest();
    });

    it('sets the .state to "connecting"', () => {
      assert.equal('connecting', test.transport.state);
    });

    it('calls .invite on the underlying SIP.js UA', () => {
      assert(test.ua.invite.calledOnce);
    });

    context('when it calls .invite on the underlying SIP.js UA', () => {
      it('sets the target to "sip:orchestrator@endpoint.twilio.com"', () => {
        assert.equal(
          'sip:orchestrator@endpoint.twilio.com',
          test.ua.invite.args[0][0]);
      });

      it('sets the X-Twilio-AccessToken to the Access Token', () => {
        assert(test.ua.invite.args[0][1].extraHeaders.includes(
          'X-Twilio-AccessToken: ' + test.accessToken));
      });

      it('sets the Session-Expires to 120', () => {
        assert(test.ua.invite.args[0][1].extraHeaders.includes(
          'Session-Expires: 120'));
      });

      it('sets the mediaHandlerFactory to return a SIPJSMediaHandler', () => {
        assert(test.ua.invite.args[0][1].mediaHandlerFactory() instanceof test.SIPJSMediaHandler);
      });

      context('the SIPJSMediaHandler', () => {
        beforeEach(() => {
          test.ua.invite.args[0][1].mediaHandlerFactory();
        });

        it('receives the PeerConnectionManager', () => {
          assert.equal(test.peerConnectionManager, test.mediaHandler.peerConnectionManager);
        });

        it('receives a createMessage function', () => {
          assert.equal('function', typeof test.mediaHandler.createMessage);
        });

        context('the createMessage function, called when the Transport\'s .state is', () => {
          context('"connected", returns an RSP message that', () => {
            var message;

            beforeEach(() => {
              test.connect();
              message = test.mediaHandler.createMessage();
            });

            it('has .name matching the name passed to the constructor', () => {
              assert.equal(test.name, message.name);
            });

            it('has .participant state matching the local ParticipantSignaling\'s state', () => {
              assert.deepEqual(test.localParticipantState, message.participant);
            });

            it('has .type "update"', () => {
              assert.equal('update', message.type);
            });

            it('has .version 1', () => {
              assert.equal(1, message.version);
            });
          });

          context('"connecting", returns an RSP message that', () => {
            var message;

            beforeEach(() => {
              message = test.mediaHandler.createMessage();
            });

            it('has .name matching the name passed to the constructor', () => {
              assert.equal(test.name, message.name);
            });

            it('has .participant state matching the local ParticipantSignaling\'s state', () => {
              assert.deepEqual(test.localParticipantState, message.participant);
            });

            it('has .type "connect"', () => {
              assert.equal('connect', message.type);
            });

            it('has .version 1', () => {
              assert.equal(1, message.version);
            });
          });

          context('"disconnected", returns an RSP message that', () => {
            var message;

            beforeEach(() => {
              test.transport.disconnect();
              message = test.mediaHandler.createMessage();
            });

            it('is a disconnect request', () => {
              assert.deepEqual({
                type: 'disconnect',
                version: 1
              }, message);
            });
          });

          context('"syncing", returns an RSP message that', () => {
            var message;

            beforeEach(() => {
              test.connect();
              test.transport.sync();
              message = test.mediaHandler.createMessage();
            });

            it('has .name matching the name passed to the constructor', () => {
              assert.equal(test.name, message.name);
            });

            it('has .participant state matching the local ParticipantSignaling\'s state', () => {
              assert.deepEqual(test.localParticipantState, message.participant);
            });

            it('has .type "sync"', () => {
              assert.equal('sync', message.type);
            });

            it('has .version 1', () => {
              assert.equal(1, message.version);
            });
          });
        });
      });
    });
  });

  describe('#disconnect, called when the Transport\'s .state is', () => {
    var test;
    var ret;

    context('"connected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.connect();
        ret = test.transport.disconnect();
      });

      it('returns true', () => {
        assert.equal(true, ret);
      });

      it('transitions to .state "disconnected"', () => {
        assert.deepEqual([
          'connected',
          'disconnected'
        ], test.transitions);
      });

      it('calls .terminate on the underlying SIP.js Session', () => {
        assert(test.session.terminate.calledOnce);
      });

      it('calls .stop on the underlying SIP.js UA', () => {
        assert(test.ua.stop.calledOnce);
      });

      context('when calling .terminate', () => {
        it('sets the body to a disconnect RSP request', () => {
          assert.deepEqual({
            type: 'disconnect',
            version: 1
          }, JSON.parse(test.session.terminate.args[0][0].body));
        });

        it('sets the Content-Type to "application/room-signaling+json"', () => {
          assert.deepEqual([
            'Content-Type: application/room-signaling+json'
          ], test.session.terminate.args[0][0].extraHeaders);
        });
      });
    });

    context('"connecting"', () => {
      beforeEach(() => {
        test = makeTest();
        ret = test.transport.disconnect();
      });

      it('returns true', () => {
        assert.equal(true, ret);
      });

      it('transitions to .state "disconnected"', () => {
        assert.deepEqual([
          'disconnected'
        ], test.transitions);
      });

      it('calls .terminate on the underlying SIP.js Session', () => {
        assert(test.session.terminate.calledOnce);
      });

      it('calls .stop on the underlying SIP.js UA', () => {
        assert(test.ua.stop.calledOnce);
      });

      context('when calling .terminate', () => {
        it('sets the body to a disconnect RSP request', () => {
          assert.deepEqual({
            type: 'disconnect',
            version: 1
          }, JSON.parse(test.session.terminate.args[0][0].body));
        });

        it('sets the Content-Type to "application/room-signaling+json"', () => {
          assert.deepEqual([
            'Content-Type: application/room-signaling+json'
          ], test.session.terminate.args[0][0].extraHeaders);
        });
      });
    });

    context('"disconnected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.transport.disconnect();
        ret = test.transport.disconnect();
      });

      it('returns false', () => {
        assert.equal(false, ret);
      });

      it('does not transition .state', () => {
        assert.deepEqual([
          'disconnected'
        ], test.transitions);
      });

      it('does not call .terminate on the underlying SIP.js Session', () => {
        assert(!test.session.terminate.calledTwice);
      });

      it('does not call .stop on the underlying SIP.js UA', () => {
        assert(!test.ua.stop.calledTwice);
      });
    });

    context('"syncing"', () => {
      beforeEach(() => {
        test = makeTest();
        test.connect();
        test.transport.sync();
        ret = test.transport.disconnect();
      });

      it('returns true', () => {
        assert.equal(true, ret);
      });

      it('transitions to .state "disconnected"', () => {
        assert.deepEqual([
          'connected',
          'syncing',
          'disconnected'
        ], test.transitions);
      });

      it('calls .terminate on the underlying SIP.js Session', () => {
        assert(test.session.terminate.calledOnce);
      });

      it('calls .stop on the underlying SIP.js UA', () => {
        assert(test.ua.stop.calledOnce);
      });

      context('when calling .terminate', () => {
        it('sets the body to a disconnect RSP request', () => {
          assert.deepEqual({
            type: 'disconnect',
            version: 1
          }, JSON.parse(test.session.terminate.args[0][0].body));
        });

        it('sets the Content-Type to "application/room-signaling+json"', () => {
          assert.deepEqual([
            'Content-Type: application/room-signaling+json'
          ], test.session.terminate.args[0][0].extraHeaders);
        });
      });
    });
  });

  describe('#publish, called when the Transport\'s .state is', () => {
    var test;
    var ret;

    // NOTE(mroberts): These are used to test .publish in the "connecting" and
    // "syncing" states below.
    var extraPublishes = [
      {
        participant: {
          revision: 1,
          tracks: []
        },
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

    var expectedPublish = {
      participant: {
        revision: 2,
        tracks: [
          { fizz: 'buzz' }
        ]
      },
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
        test.connect();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('returns true', () => {
        assert.equal(true, ret);
      });

      it('calls .sendRequest on the underlying SIP.js Session', () => {
        assert(test.session.sendRequest.calledOnce);
      });

      context('when it calls .sendRequest on the underlyng SIP.js Session', () => {
        it('sets the request type to "INFO"', () => {
          assert.equal('INFO', test.session.sendRequest.args[0][0]);
        });

        it('sets the body to an update RSP message', () => {
          assert.deepEqual({
            foo: 'bar',
            type: 'update',
            version: 1
          }, JSON.parse(test.session.sendRequest.args[0][1].body));
        });

        it('sets the Content-Type to "application/room-signaling+json"', () => {
          assert(test.session.sendRequest.args[0][1].extraHeaders.includes(
            'Content-Type: application/room-signaling+json'));
        });

        it('sets the Event to "room-signaling"', () => {
          assert(test.session.sendRequest.args[0][1].extraHeaders.includes(
            'Event: room-signaling'));
        });

        it('sets the Info-Package to "room-signaling"', () => {
          assert(test.session.sendRequest.args[0][1].extraHeaders.includes(
            'Info-Package: room-signaling'));
        });
      });

      context('when fails with a 5xx error', () => {
        var test;
        var sendRequestCallTimes = [];

        beforeEach(() => {
          return new Promise(resolve => {
            test = makeTest({
              sendRequest(type, request) {
                sendRequestCallTimes.push(Date.now());
                request.receiveResponse({ status_code: 500 });
                if (sendRequestCallTimes.length === constants.PUBLISH_MAX_ATTEMPTS) {
                  resolve();
                }
              }
            });
            sendRequestCallTimes = [];
            test.connect();
            test.transport.publish({ foo: 'bar' });
          });
        });

        it('should execute the exponential backoff', () => {
          var allowance = constants.PUBLISH_BACKOFF_MS >> 1;
          var backoff = constants.PUBLISH_BACKOFF_MS;
          var jitter = constants.PUBLISH_BACKOFF_JITTER;
          var delay;
          var high;
          var low;

          assert.equal(sendRequestCallTimes.length, constants.PUBLISH_MAX_ATTEMPTS);
          for (var i = 1; i < sendRequestCallTimes.length; i++) {
            delay = sendRequestCallTimes[i] - sendRequestCallTimes[i - 1];
            high = backoff * (1 << (i - 1)) + jitter + allowance;
            low = backoff * (1 << (i - 1)) - jitter;
            assert(delay <= high && delay >= low);
          }
        });
      });
    });

    context('"connecting"', () => {
      beforeEach(() => {
        test = makeTest();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('returns true', () => {
        assert.equal(true, ret);
      });

      it('does not call .sendRequest on the underlying SIP.js Session', () => {
        assert(!test.session.sendRequest.calledOnce);
      });

      context('when the .state transitions to', () => {
        beforeEach(() => {
          extraPublishes.forEach(test.transport.publish, test.transport);
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.connect();
          });

          it('calls .sendRequest on the underlying SIP.js Session', () => {
            assert(test.session.sendRequest.calledOnce);
          });

          context('when it calls .sendRequest on the underlyng SIP.js Session', () => {
            it('sets the request type to "INFO"', () => {
              assert.equal('INFO', test.session.sendRequest.args[0][0]);
            });

            it('sets the body to an update RSP message combining any updates .publish-ed while the Transport\'s .state was "connecting"', () => {
              assert.deepEqual(
                expectedPublish,
                JSON.parse(test.session.sendRequest.args[0][1].body));
            });

            it('sets the Content-Type to "application/room-signaling+json"', () => {
              assert(test.session.sendRequest.args[0][1].extraHeaders.includes(
                'Content-Type: application/room-signaling+json'));
            });

            it('sets the Event to "room-signaling"', () => {
              assert(test.session.sendRequest.args[0][1].extraHeaders.includes(
                'Event: room-signaling'));
            });

            it('sets the Info-Package to "room-signaling"', () => {
              assert(test.session.sendRequest.args[0][1].extraHeaders.includes(
                'Info-Package: room-signaling'));
            });
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.transport.disconnect();
          });

          it('does not call .sendRequest on the underlying SIP.js Session', () => {
            assert(!test.session.sendRequest.calledTwice);
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

      it('returns false', () => {
        assert.equal(false, ret);
      });

      it('does not call .sendRequest on the underlying SIP.js Session', () => {
        assert(!test.session.sendRequest.calledOnce);
      });
    });

    context('"syncing"', () => {
      beforeEach(() => {
        test = makeTest();
        test.connect();
        test.transport.sync();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('returns true', () => {
        assert.equal(true, ret);
      });

      it('does not call .sendRequest on the underlying SIP.js Session', () => {
        assert(!test.session.sendRequest.calledOnce);
      });

      context('when the .state transitions to', () => {
        beforeEach(() => {
          extraPublishes.forEach(test.transport.publish, test.transport);
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.sync();
          });

          it('calls .sendRequest on the underlying SIP.js Session', () => {
            assert(test.session.sendRequest.calledOnce);
          });

          context('when it calls .sendRequest on the underlyng SIP.js Session', () => {
            it('sets the request type to "INFO"', () => {
              assert.equal('INFO', test.session.sendRequest.args[0][0]);
            });

            it('sets the body to an update RSP message combining any updates .publish-ed while the Transport\'s .state was "connecting"', () => {
              assert.deepEqual(
                expectedPublish,
                JSON.parse(test.session.sendRequest.args[0][1].body));
            });

            it('sets the Content-Type to "application/room-signaling+json"', () => {
              assert(test.session.sendRequest.args[0][1].extraHeaders.includes(
                'Content-Type: application/room-signaling+json'));
            });

            it('sets the Event to "room-signaling"', () => {
              assert(test.session.sendRequest.args[0][1].extraHeaders.includes(
                'Event: room-signaling'));
            });

            it('sets the Info-Package to "room-signaling"', () => {
              assert(test.session.sendRequest.args[0][1].extraHeaders.includes(
                'Info-Package: room-signaling'));
            });
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.transport.disconnect();
          });

          it('does not call .sendRequeston the underlying SIP.js Session', () => {
            assert(!test.session.sendRequest.calledTwice);
          });
        });
      });
    });
  });

  describe('#sync, called when the Transport\'s .state is', () => {
    var test;
    var ret;

    context('"connected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.connect();
        ret = test.transport.sync();
      });

      it('returns true', () => {
        assert.equal(true, ret);
      });

      it('transitions to .state "syncing"', () => {
        assert.deepEqual([
          'connected',
          'syncing'
        ], test.transitions);
      });

      it('calls .sendReinvite on the underlying SIP.js Session', () => {
        assert(test.session.sendReinvite.calledOnce);
      });
    });

    context('"connecting"', () => {
      beforeEach(() => {
        test = makeTest();
        ret = test.transport.sync();
      });

      it('returns false', () => {
        assert.equal(false, ret);
      });

      it('does not transition .state', () => {
        assert.deepEqual([
        ], test.transitions);
      });

      it('does not call .sendReinvite on the underlying SIP.js Session', () => {
        assert(!test.session.sendReinvite.calledOnce);
      });
    });

    context('"disconnected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.transport.disconnect();
        ret = test.transport.sync();
      });

      it('returns false', () => {
        assert.equal(false, ret);
      });

      it('does not transition .state', () => {
        assert.deepEqual([
          'disconnected'
        ], test.transitions);
      });

      it('does not call .sendReinvite on the underlying SIP.js Session', () => {
        assert(!test.session.sendReinvite.calledOnce);
      });
    });

    context('"syncing"', () => {
      beforeEach(() => {
        test = makeTest();
        test.connect();
        test.transport.sync();
        ret = test.transport.sync();
      });

      it('returns false', () => {
        assert.equal(false, ret);
      });

      it('does not transition .state', () => {
        assert.deepEqual([
          'connected',
          'syncing'
        ], test.transitions);
      });

      it('does not call .sendReinvite on the underlying SIP.js Session', () => {
        assert(!test.session.sendReinvite.calledTwice);
      });
    });
  });

  describe('the underlying SIP.js Session emits', () => {
    var test;

    beforeEach(() => {
      test = makeTest();
    });

    context('an "accepted" event, and the Transport\'s .state is', () => {
      context('"connected", and the request contains an RSP message with type', () => {
        var eventEmitted;

        beforeEach(() => {
          test.connect();
          eventEmitted = false;
          test.transport.once('connected', () => eventEmitted = true);
          test.transport.once('message', () => eventEmitted = true);
          test.transitions = [];
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.accepted({ type: 'connected' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.accepted({ type: 'disconnected' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"error"', () => {
          beforeEach(() => {
            test.accepted({ type: 'error' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"synced"', () => {
          beforeEach(() => {
            test.accepted({ type: 'synced' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"update"', () => {
          beforeEach(() => {
            test.accepted({ type: 'update' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });
      });

      context('"connecting", and the request contains an RSP message with type', () => {
        context('"connected"', () => {
          var message = {
            type: 'connected',
            foo: 'bar'
          };
          var connectedEvent;
          var messageEvent;

          beforeEach(() => {
            connectedEvent = null;
            messageEvent = false;
            test.transport.once('connected', message => connectedEvent = message);
            test.transport.once('message', () => messageEvent = true);
            test.accepted(message);
          });

          it('emits a "connected" event with the RSP message', () => {
            assert.deepEqual(message, connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('transitions .state to "connected"', () => {
            assert.deepEqual([
              'connected'
            ], test.transitions);
          });
        });

        context('"disconnected"', () => {
          var connectedEvent;
          var messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = false;
            test.transport.once('connected', () => connectedEvent = true);
            test.transport.once('message', () => messageEvent = true);
            test.accepted({ type: 'disconnected' });
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('transitions .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
          });
        });

        context('"error"', () => {
          var connectedEvent;
          var messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = false;
            test.transport.once('connected', () => connectedEvent = true);
            test.transport.once('message', () => messageEvent = true);
            test.accepted({ type: 'error' });
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('transitions .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
          });
        });

        context('"error" with code and message in the response body', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error', code: 12345, message: 'foo bar' }, 'accepted');
          });

          it('calls #disconnect() with a TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 12345);
            assert.equal(error.message, 'foo bar');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with code and message in the response header', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'accepted', { 'X-Twilio-Error': '67890 bar baz' });
          });

          it('calls #disconnect() with a TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 67890);
            assert.equal(error.message, 'bar baz');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with no code or message in either the body or the header', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'accepted', { 'X-Twilio-Foo': '12345 foo bar' });
          });

          it('calls #disconnect() with an unknown TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 0);
            assert.equal(error.message, 'Unknown error');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"synced"', () => {
          var message = {
            type: 'synced'
          };
          var connectedEvent;
          var messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = null;
            test.transport.once('connected', () => connectedEvent = true);
            test.transport.once('message', message => messageEvent = message);
            test.accepted(message);
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('does not transition .state', () => {
            assert.deepEqual([], test.transitions);
          });

          context('when the Transport\'s .state transitions to', () => {
            context('"connected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'connected' });
              });

              it('emits an "message" event with the RSP message with type "synced"', () => {
                assert.deepEqual(message, messageEvent);
              });
            });

            context('"disconnected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'disconnected' });
              });

              it('does not emit an "message" event', () => {
                assert(!messageEvent);
              });
            });
          });
        });

        context('"update"', () => {
          var message = {
            type: 'update'
          };
          var connectedEvent;
          var messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = null;
            test.transport.once('connected', () => connectedEvent = true);
            test.transport.once('message', message => messageEvent = message);
            test.accepted(message);
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('does not transition .state', () => {
            assert.deepEqual([], test.transitions);
          });

          context('when the Transport\'s .state transitions to', () => {
            context('"connected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'connected' });
              });

              it('emits an "message" event with the RSP message with type "update"', () => {
                assert.deepEqual(message, messageEvent);
              });
            });

            context('"disconnected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'disconnected' });
              });

              it('does not emit an "message" event', () => {
                assert(!messageEvent);
              });
            });
          });
        });
      });

      context('"disconnected", and the request contains an RSP message with type', () => {
        var connectedEvent;
        var messageEvent;

        beforeEach(() => {
          test.receiveRequest({ type: 'disconnected' });
          test.transitions = [];
          connectedEvent = false;
          messageEvent = false;
          test.transport.once('connected', () => connectedEvent = true);
          test.transport.once('message', () => messageEvent = true);
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.accepted({ type: 'connected' });
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('does not transition .state', () => {
            assert.deepEqual([], test.transitions);
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.accepted({ type: 'disconnected' });
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('does not transition .state', () => {
            assert.deepEqual([], test.transitions);
          });
        });

        context('"error"', () => {
          beforeEach(() => {
            test.accepted({ type: 'error' });
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('does not transition .state', () => {
            assert.deepEqual([], test.transitions);
          });
        });

        context('"synced"', () => {
          beforeEach(() => {
            test.accepted({ type: 'synced' });
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('does not transition .state', () => {
            assert.deepEqual([], test.transitions);
          });
        });

        context('"update"', () => {
          beforeEach(() => {
            test.accepted({ type: 'update' });
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('does not transition .state', () => {
            assert.deepEqual([], test.transitions);
          });
        });
      });

      context('"syncing", and the request contains an RSP message with type', () => {
        var eventEmitted;

        beforeEach(() => {
          test.connect();
          test.transport.sync();
          test.transitions = [];
          eventEmitted = false;
          test.transport.once('connected', () => eventEmitted = true);
          test.transport.once('message', () => eventEmitted = true);
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.accepted({ type: 'connected' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.accepted({ type: 'disconnected' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"error"', () => {
          beforeEach(() => {
            test.accepted({ type: 'error' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"synced"', () => {
          beforeEach(() => {
            test.accepted({ type: 'synced' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"update"', () => {
          beforeEach(() => {
            test.accepted({ type: 'update' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });
      });
    });

    context('a "failed" event, and the Transport\'s .state is', () => {
      var evtPayloads = [
        [ ],
        [ { body: '{ "type": "error", "code": 12345 "message": "foo bar" }' } ],
        [ { body: '{ "type": "error", "code": 12345, "message": "foo bar" }' } ],
        [ { headers: { 'X-Twilio-Error': [ { raw: '67890 bar baz' } ] } } ],
        [ null, 'Request Timeout' ],
        [ null, 'Connection Error' ]
      ];
      var evtPayloadsIdx = 0;
      var eventEmitted;

      function setupTest() {
        test.transitions = [];
        eventEmitted = false;
        test.transport.once('connected', () => eventEmitted = true);
        test.transport.once('message', () => eventEmitted = true);
        test.session.emit.apply(test.session, ['failed'].concat(evtPayloads[evtPayloadsIdx]));
      }

      context('"connected"', () => {
        beforeEach(() => {
          test.connect();
          setupTest();
        });

        it('does nothing', () => {
          assert(!eventEmitted);
          assert.deepEqual([], test.transitions);
        });
      });

      context('"connecting"', () => {
        var disconnect;
        beforeEach(() => {
          disconnect = test.transport.disconnect;
          if (evtPayloadsIdx > 0) {
            test.transport.disconnect = sinon.spy();
          }
          setupTest();
        });

        it('transitions .state to "disconnected"', () => {
          assert.deepEqual([
            'disconnected'
          ], test.transitions);
        });

        it('should call #disconnect() with SignalingIncomingMessageInvalidError when event payload has an error body with invalid JSON', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingIncomingMessageInvalidError();
          assert(error instanceof SignalingIncomingMessageInvalidError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when event payload has an error body', () => {
          var error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 12345);
          assert.equal(error.message, 'foo bar');
        });

        it('should call #disconnect() with TwilioError when event payload has an error header', () => {
          var error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 67890);
          assert.equal(error.message, 'bar baz');
        });

        it('should call #disconnect() with TwilioError when cause is "Request Timeout"', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingConnectionTimeoutError();
          assert(error instanceof SignalingConnectionTimeoutError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when cause is "Connection Error"', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingConnectionError();
          assert(error instanceof SignalingConnectionError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        afterEach(() => {
          if(evtPayloadsIdx > 0) {
            test.transport.disconnect = disconnect;
          }
          evtPayloadsIdx = (evtPayloadsIdx + 1) % evtPayloads.length;
        });
      });

      context('"disconnected"', () => {
        beforeEach(() => {
          test.transport.disconnect();
          setupTest();
        });

        it('does nothing', () => {
          assert(!eventEmitted);
          assert.deepEqual([], test.transitions);
        });
      });

      context('"syncing"', () => {
        beforeEach(() => {
          test.connect();
          test.transport.sync();
          setupTest();
        });

        it('does nothing', () => {
          assert(!eventEmitted);
          assert.deepEqual([], test.transitions);
        });
      });
    });

    context('an "info" event, and the Transport\'s .state is', () => {
      context('"connected", and the request contains an RSP message with type', () => {
        beforeEach(() => {
          test.connect();
        });

        context('"connected"', () => {
          var message = {
            type: 'connected'
          };
          var emittedEvent;

          beforeEach(() => {
            emittedEvent = null;
            test.transport.once('message', message => emittedEvent = message);
            test.receiveRequest(message);
          });

          it('emits an "message" event with the RSP message', () => {
            assert.deepEqual(message, emittedEvent);
          });
        });

        context('"disconnected"', () => {
          var message = {
            type: 'disconnected'
          };

          beforeEach(() => {
            test.transitions = [];
            test.receiveRequest(message);
          });

          it('transitions .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
          });
        });

        context('"error"', () => {
          var message = {
            type: 'error'
          };

          beforeEach(() => {
            test.transitions = [];
            test.receiveRequest(message);
          });

          it('transitions .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
          });
        });

        context('"error" with code and message in the response body', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error', code: 12345, message: 'foo bar' }, 'info');
          });

          it('calls #disconnect() with a TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 12345);
            assert.equal(error.message, 'foo bar');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with code and message in the response header', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Error': '67890 bar baz' });
          });

          it('calls #disconnect() with a TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 67890);
            assert.equal(error.message, 'bar baz');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with no code or message in either the body or the header', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Foo': '12345 foo bar' });
          });

          it('calls #disconnect() with a unknown TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 0);
            assert.equal(error.message, 'Unknown error');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"synced"', () => {
          var message = {
            type: 'synced'
          };
          var emittedEvent;

          beforeEach(() => {
            emittedEvent = null;
            test.transport.once('message', message => emittedEvent = message);
            test.receiveRequest(message);
          });

          it('emits an "message" event with the RSP message', () => {
            assert.deepEqual(message, emittedEvent);
          });
        });

        context('"update"', () => {
          var message = {
            type: 'update'
          };
          var emittedEvent;

          beforeEach(() => {
            emittedEvent = null;
            test.transport.once('message', message => emittedEvent = message);
            test.receiveRequest(message);
          });

          it('emits an "message" event with the RSP message', () => {
            assert.deepEqual(message, emittedEvent);
          });
        });
      });

      context('"connecting", and the request contains an RSP message with type', () => {
        context('"connected"', () => {
          var message = {
            type: 'connected'
          };
          var connectedEvent;
          var messageEvent;

          beforeEach(() => {
            connectedEvent = null;
            messageEvent = false;
            test.transport.once('connected', message => connectedEvent = message);
            test.transport.once('message', () => messageEvent = true);
            test.receiveRequest(message);
          });

          it('emits a "connected" event with the RSP message', () => {
            assert.deepEqual(message, connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert(!messageEvent);
          });

          it('transitions .state to "connected"', () => {
            assert.deepEqual([
              'connected'
            ], test.transitions);
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.receiveRequest({ type: 'disconnected' });
          });

          it('transitions .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
          });
        });

        context('"error"', () => {
          beforeEach(() => {
            test.receiveRequest({ type: 'error' });
          });

          it('transitions .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
          });
        });

        context('"error" with code and message in the response body', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error', code: 12345, message: 'foo bar' }, 'info');
          });

          it('calls #disconnect() with a TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 12345);
            assert.equal(error.message, 'foo bar');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with code and message in the response header', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Error': '67890 bar baz' });
          });

          it('calls #disconnect() with a TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 67890);
            assert.equal(error.message, 'bar baz');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with no code or message in either the body or the header', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Foo': '12345 foo bar' });
          });

          it('calls #disconnect() with a unknown TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 0);
            assert.equal(error.message, 'Unknown error');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"synced"', () => {
          var message = {
            type: 'synced'
          };
          var connectedEvent;
          var messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = false;
            test.transport.once('connected', () => connectedEvent = true);
            test.transport.once('message', message => messageEvent = message);
            test.receiveRequest(message);
          });

          it('does nothing', () => {
            assert(!connectedEvent);
            assert(!messageEvent);
            assert.deepEqual([], test.transitions);
          });

          context('when the Transport\'s .state transitions to', () => {
            context('"connected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'connected' });
              });

              it('emits an "message" event with the RSP message with type "synced"', () => {
                assert.deepEqual(message, messageEvent);
              });
            });

            context('"disconnected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'disconnected' });
              });

              it('does not emit an "message" event', () => {
                assert(!messageEvent);
              });
            });
          });
        });

        context('"update"', () => {
          var message = {
            type: 'update'
          };
          var connectedEvent;
          var messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = false;
            test.transport.once('connected', () => connectedEvent = true);
            test.transport.once('message', message => messageEvent = message);
            test.receiveRequest(message);
          });

          it('does nothing', () => {
            assert(!connectedEvent);
            assert(!messageEvent);
            assert.deepEqual([], test.transitions);
          });

          context('when the Transport\'s .state transitions to', () => {
            context('"connected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'connected' });
              });

              it('emits an "message" event with the RSP message with type "update"', () => {
                assert.deepEqual(message, messageEvent);
              });
            });

            context('"disconnected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'disconnected' });
              });

              it('does not emit an "message" event', () => {
                assert(!messageEvent);
              });
            });
          });
        });
      });

      context('"disconnected", and the request contains an RSP message with type', () => {
        var eventEmitted;

        beforeEach(() => {
          test.transport.disconnect();
          test.transitions = [];
          eventEmitted = false;
          test.transport.once('connected', () => eventEmitted = true);
          test.transport.once('message', () => eventEmitted = true);
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.receiveRequest({ type: 'connected' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.receiveRequest({ type: 'disconnected' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"error"', () => {
          beforeEach(() => {
            test.receiveRequest({ type: 'error' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"synced"', () => {
          beforeEach(() => {
            test.sync();
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });

        context('"update"', () => {
          beforeEach(() => {
            test.receiveRequest({ type: 'update' });
          });

          it('does nothing', () => {
            assert(!eventEmitted);
            assert.deepEqual([], test.transitions);
          });
        });
      });

      context('"syncing", and the request contains an RSP message with type', () => {
        beforeEach(() => {
          test.connect();
          test.transport.sync();
          test.transitions = [];
        });

        context('"connected"', () => {
          var message = {
            type: 'connected'
          };
          var connectedEvent;
          var messageEvents;

          beforeEach(() => {
            connectedEvent = false;
            messageEvents = [];
            test.transport.once('connected', () => connectedEvent = true);
            test.transport.on('message', message => messageEvents.push(message));
            test.receiveRequest(message);
          });

          it('does not emit a "connected" event', () => {
            assert(!connectedEvent);
          });

          it('does not emit an "message" event', () => {
            assert.equal(0, messageEvents.length);
          });

          context('when the Transport\'s .state transitions to', () => {
            context('"connected"', () => {
              beforeEach(() => {
                test.sync();
              });

              it('emits an "message" event with the RSP message with type "connected"', () => {
                assert.deepEqual(message, messageEvents[1]);
              });
            });

            context('"disconnected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'disconnected' });
              });

              it('does not emit an "message" event', () => {
                assert.equal(0, messageEvents.length);
              });
            });
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.receiveRequest({ type: 'disconnected' });
          });

          it('transitions .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
          });
        });

        context('"error"', () => {
          beforeEach(() => {
            test.receiveRequest({ type: 'error' });
          });

          it('transitions .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
          });
        });

        context('"error" with code and message in the response body', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error', code: 12345, message: 'foo bar' }, 'info');
          });

          it('calls #disconnect() with a TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 12345);
            assert.equal(error.message, 'foo bar');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with code and message in the response header', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Error': '67890 bar baz' });
          });

          it('calls #disconnect() with a TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 67890);
            assert.equal(error.message, 'bar baz');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with no code or message in either the body or the header', () => {
          var disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Foo': '12345 foo bar' });
          });

          it('calls #disconnect() with a unknown TwilioError', () => {
            var error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 0);
            assert.equal(error.message, 'Unknown error');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"synced"', () => {
          var message = {
            type: 'synced'
          };
          var connectedEvent;
          var messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = false;
            test.transport.once('connected', () => connectedEvent = true);
            test.transport.once('message', message => messageEvent = message);
            test.receiveRequest(message);
          });

          it('emits an "message" event with the RSP message with type "synced"', () => {
            assert.deepEqual(message, messageEvent);
          });

          it('transitions .state to "connected"', () => {
            assert.deepEqual([
              'connected'
            ], test.transitions);
          });
        });

        context('"update"', () => {
          var message = {
            type: 'update'
          };
          var connectedEvent;
          var messageEvents;

          beforeEach(() => {
            connectedEvent = false;
            messageEvents = [];
            test.transport.once('connected', () => connectedEvent = true);
            test.transport.on('message', message => messageEvents.push(message));
            test.receiveRequest(message);
          });

          it('does nothing', () => {
            assert(!connectedEvent);
            assert.equal(0, messageEvents.length);
            assert.deepEqual([], test.transitions);
          });

          context('when the Transport\'s .state transitions to', () => {
            context('"connected"', () => {
              beforeEach(() => {
                test.sync();
              });

              it('emits an "message" event with the RSP message with type "update"', () => {
                assert.deepEqual(message, messageEvents[1]);
              });
            });

            context('"disconnected"', () => {
              beforeEach(() => {
                test.receiveRequest({ type: 'disconnected' });
              });

              it('does not emit an "message" event', () => {
                assert.equal(0, messageEvents.length);
              });
            });
          });
        });
      });
    });

    context('a "bye" event, and the Transport\'s .state is', () => {
      var evtPayloads = [
        [ ],
        [ { body: '{ "type": "error", "code": 12345 "message": "foo bar" }' } ],
        [ { body: '{ "type": "error", "code": 12345, "message": "foo bar" }' } ],
        [ { headers: { 'X-Twilio-Error': [ { raw: '67890 bar baz' } ] } } ],
        [ null, 'Request Timeout' ],
        [ null, 'Connection Error' ]
      ];
      var evtPayloadsIdx = 0;

      context('"connected"', () => {
        var disconnect;

        beforeEach(() => {
          disconnect = test.transport.disconnect;
          if (evtPayloadsIdx > 0) {
            test.transport.disconnect = sinon.spy();
          }

          test.connect();
          test.transitions = [];
          test.session.emit.apply(test.session, ['bye'].concat(evtPayloads[evtPayloadsIdx]));
        });

        it('transitions .state to "disconnected"', () => {
          assert.deepEqual([
            'disconnected'
          ], test.transitions);
        });

        it('should call #disconnect() with SignalingIncomingMessageInvalidError when event payload has an error body with invalid JSON', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingIncomingMessageInvalidError();
          assert(error instanceof SignalingIncomingMessageInvalidError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when event payload has an error body', () => {
          var error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 12345);
          assert.equal(error.message, 'foo bar');
        });

        it('should call #disconnect() with TwilioError when event payload has an error header', () => {
          var error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 67890);
          assert.equal(error.message, 'bar baz');
        });

        it('should call #disconnect() with TwilioError when cause is "Request Timeout"', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingConnectionTimeoutError();
          assert(error instanceof SignalingConnectionTimeoutError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when cause is "Connection Error"', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingConnectionError();
          assert(error instanceof SignalingConnectionError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        afterEach(() => {
          if (evtPayloadsIdx > 0) {
            test.transport.disconnect = disconnect;
          }
          evtPayloadsIdx = (evtPayloadsIdx + 1) % evtPayloads.length;
        });
      });

      context('"connecting"', () => {
        var disconnect;

        beforeEach(() => {
          disconnect = test.transport.disconnect;
          if (evtPayloadsIdx > 0) {
            test.transport.disconnect = sinon.spy();
          }
          test.session.emit.apply(test.session, ['bye'].concat(evtPayloads[evtPayloadsIdx]));
        });

        it('transitions .state to "disconnected"', () => {
          assert.deepEqual([
            'disconnected'
          ], test.transitions);
        });

        it('should call #disconnect() with SignalingIncomingMessageInvalidError when event payload has an error body with invalid JSON', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingIncomingMessageInvalidError();
          assert(error instanceof SignalingIncomingMessageInvalidError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when event payload has an error body', () => {
          var error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 12345);
          assert.equal(error.message, 'foo bar');
        });

        it('should call #disconnect() with TwilioError when event payload has an error header', () => {
          var error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 67890);
          assert.equal(error.message, 'bar baz');
        });

        it('should call #disconnect() with TwilioError when cause is "Request Timeout"', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingConnectionTimeoutError();
          assert(error instanceof SignalingConnectionTimeoutError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when cause is "Connection Error"', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingConnectionError();
          assert(error instanceof SignalingConnectionError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        afterEach(() => {
          if(evtPayloadsIdx > 0) {
            test.transport.disconnect = disconnect;
          }
          evtPayloadsIdx = (evtPayloadsIdx + 1) % evtPayloads.length;
        });
      });

      context('"disconnected"', () => {
        beforeEach(() => {
          test.transport.disconnect();
          test.transitions = [];
          test.session.emit('bye');
        });

        it('does not transition .state', () => {
          assert.deepEqual([], test.transitions);
        });

        it('does not call .terminate on the underlying SIP.js Session', () => {
          assert(!test.session.terminate.calledTwice);
        });
      });

      context('"syncing"', () => {
        var disconnect;

        beforeEach(() => {
          disconnect = test.transport.disconnect;
          if (evtPayloadsIdx > 0) {
            test.transport.disconnect = sinon.spy();
          }
          test.connect();
          test.transport.sync();
          test.transitions = [];
          test.session.emit.apply(test.session, ['bye'].concat(evtPayloads[evtPayloadsIdx]));
        });

        it('transitions .state to "disconnected"', () => {
          assert.deepEqual([
            'disconnected'
          ], test.transitions);
        });

        it('should call #disconnect() with SignalingIncomingMessageInvalidError when event payload has an error body with invalid JSON', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingIncomingMessageInvalidError();
          assert(error instanceof SignalingIncomingMessageInvalidError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when event payload has an error body', () => {
          var error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 12345);
          assert.equal(error.message, 'foo bar');
        });

        it('should call #disconnect() with TwilioError when event payload has an error header', () => {
          var error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 67890);
          assert.equal(error.message, 'bar baz');
        });

        it('should call #disconnect() with TwilioError when cause is "Request Timeout"', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingConnectionTimeoutError();
          assert(error instanceof SignalingConnectionTimeoutError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when cause is "Connection Error"', () => {
          var error = test.transport.disconnect.args[0][0];
          var expectedError = new SignalingConnectionError();
          assert(error instanceof SignalingConnectionError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        afterEach(() => {
          if(evtPayloadsIdx > 0) {
            test.transport.disconnect = disconnect;
          }
          evtPayloadsIdx = (evtPayloadsIdx + 1) % evtPayloads.length;
        });
      });
    });
  });
});

function makeTest(options) {
  options = options || {};
  options.name = 'name' in options ? options.name : makeName();
  options.accessToken = options.accessToken || makeAccessToken();
  options.localParticipantState = options.localParticipantState || {
    revision: 1,
    tracks: [
      { whiz: 'bang' }
    ]
  };
  options.localParticipant = options.localParticipant || makeLocalParticipant(options);
  options.peerConnectionManager = options.peerConnectionManager || makePeerConnectionManager(options);
  options.session = options.session || makeSession(options);
  options.ua = options.ua || makeUA(options);
  options.SIPJSMediaHandler = options.SIPJSMediaHandler || makeSIPJSMediaHandlerConstructor(options);
  options.transport = options.transport || new Transport(
    options.name,
    options.accessToken,
    options.localParticipant,
    options.peerConnectionManager,
    options.ua,
    options);
  options.transitions = [];
  options.transport.on('stateChanged', state => {
    options.transitions.push(state);
  });
  options.receiveRequest = (message, type, headers) => {
    headers = Object.keys(headers || {}).reduce((headers_, name) => {
      headers_[name] = [ { raw: headers[name] } ];
      return headers_;
    }, {});
    options.session.emit(type || 'info', {
      headers: headers,
      body: JSON.stringify(message)
    });
  };
  options.accepted = message => options.receiveRequest(message, 'accepted');
  options.failed = () => options.session.emit('failed');
  options.connect = () => options.accepted({ type: 'connected' });
  options.sync = () => options.receiveRequest({ type: 'synced' });
  return options;
}

function makeName() {
  return Math.random().toString(36).slice(2);
}

function makeAccessToken() {
  return Math.random().toString(36).slice(2);
}

function makeLocalParticipant(options) {
  var localParticipant = {};
  localParticipant.getState = sinon.spy(() => options.localParticipantState);
  return localParticipant;
}

function makePeerConnectionManager(options) {
  return {};
}

function makeSession(options) {
  options.sendRequest = options.sendRequest || (() => {});
  var session = new EventEmitter();
  session.terminate = sinon.spy(() => {});
  session.sendReinvite = sinon.spy(() => {});
  session.sendRequest = sinon.spy(options.sendRequest);
  return session;
}

function makeUA(options) {
  var ua = {};
  ua.invite = sinon.spy(() => options.session);
  ua.once = sinon.spy(() => {});
  ua.stop = sinon.spy(() => {});
  return ua;
}

function makeSIPJSMediaHandlerConstructor(testOptions) {
  return function SIPJSMediaHandler(peerConnectionManager, createMessage) {
    this.peerConnectionManager = peerConnectionManager;
    this.createMessage = createMessage;
    testOptions.mediaHandler = this;
    return this;
  };
}
