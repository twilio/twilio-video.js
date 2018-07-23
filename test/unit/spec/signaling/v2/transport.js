'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const { version } = require('../../../../../package.json');
const Transport = require('../../../../../lib/signaling/v2/transport');
const { PUBLISH_MAX_ATTEMPTS } = require('../../../../../lib/util/constants');

const {
  RoomCompletedError,
  SignalingConnectionDisconnectedError,
  SignalingConnectionError,
  SignalingConnectionTimeoutError,
  SignalingIncomingMessageInvalidError
} = require('../../../../../lib/util/twilio-video-errors');

const TwilioError = require('../../../../../lib/util/twilioerror');

describe('Transport', () => {
  describe('constructor', () => {
    let test;

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
            let message;

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
            let message;

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

            it('has .publisher.name "twilio-video.js"', () => {
              assert.equal('twilio-video.js', message.publisher.name);
            });

            it('has .publisher.sdk_version equal to the package.json version', () => {
              assert.equal(version, message.publisher.sdk_version);
            });

            it('has a .publisher.user_agent string', () => {
              assert.equal('string', typeof message.publisher.user_agent);
            });

            it('has .version 1', () => {
              assert.equal(1, message.version);
            });

            it.skip('advertises support for Network Quality Signaling over RTCDataChannel', () => {
              assert.deepEqual(message.media_signaling.network_quality, {
                transports: [
                  { type: 'data-channel' }
                ]
              });
            });
          });

          context('"disconnected", returns an RSP message that', () => {
            let message;

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
            let message;

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

  describe('constructor, when createMessage is called within the SIPJSMediaHandler constructor', () => {
    it('returns an RSP message that has a .publisher.user_agent string', () => {
      const testOptions = {
        SIPJSMediaHandler: function SIPJSMediaHandler(peerConnectionManager, createMessage) {
          this.peerConnectionManager = peerConnectionManager;
          this.createMessage = createMessage;
          testOptions.message = createMessage();
          return this;
        },
        session: makeSession({}),
        ua: makeUA({})
      };

      testOptions.ua.invite = sinon.spy((target, { mediaHandlerFactory }) => {
        testOptions.mediaHandler = mediaHandlerFactory();
        return testOptions.session;
      });

      const test = makeTest(testOptions);
      assert.equal(typeof test.message.publisher.user_agent, 'string');
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

      it('calls .disconnect() on the underlying ._eventPublisher', () => {
        sinon.assert.calledOnce(test.eventPublisher.disconnect);
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

      it('calls .disconnect() on the underlying ._eventPublisher', () => {
        sinon.assert.calledOnce(test.eventPublisher.disconnect);
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

      it('does not call .disconnect() on the underlying ._eventPublisher', () => {
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
        const sendRequestCallTimes = [];

        let test;

        beforeEach(() => {
          return new Promise(resolve => {
            test = makeTest({
              sendRequest(type, request) {
                sendRequestCallTimes.push(Date.now());
                // eslint-disable-next-line camelcase
                request.receiveResponse({ status_code: 500 });
                if (sendRequestCallTimes.length === PUBLISH_MAX_ATTEMPTS) {
                  resolve();
                }
              }
            });
            sendRequestCallTimes.splice(0);
            test.connect();
            test.transport.publish({ foo: 'bar' });
          });
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
    let test;

    beforeEach(() => {
      test = makeTest();
    });

    context('an "accepted" event, and the Transport\'s .state is', () => {
      context('"connected", and the request contains an RSP message with type', () => {
        let eventEmitted;

        beforeEach(() => {
          test.connect();
          eventEmitted = false;
          test.transport.once('connected', () => { eventEmitted = true; });
          test.transport.once('message', () => { eventEmitted = true; });
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
          const message = {
            type: 'connected',
            foo: 'bar'
          };

          let connectedEvent;
          let messageEvent;

          beforeEach(() => {
            connectedEvent = null;
            messageEvent = false;
            test.transport.once('connected', message => { connectedEvent = message; });
            test.transport.once('message', () => { messageEvent = true; });
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
          let connectedEvent;
          let messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = false;
            test.transport.once('connected', () => { connectedEvent = true; });
            test.transport.once('message', () => { messageEvent = true; });
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
          let connectedEvent;
          let messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = false;
            test.transport.once('connected', () => { connectedEvent = true; });
            test.transport.once('message', () => { messageEvent = true; });
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
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error', code: 12345, message: 'foo bar' }, 'accepted');
          });

          it('calls #disconnect() with a TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 12345);
            assert.equal(error.message, 'foo bar');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with code and message in the response header', () => {
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'accepted', { 'X-Twilio-Error': '67890 bar baz' });
          });

          it('calls #disconnect() with a TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 67890);
            assert.equal(error.message, 'bar baz');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with no code or message in either the body or the header', () => {
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'accepted', { 'X-Twilio-Foo': '12345 foo bar' });
          });

          it('calls #disconnect() with an unknown TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 0);
            assert.equal(error.message, 'Unknown error');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"synced"', () => {
          const message = {
            type: 'synced'
          };

          let connectedEvent;
          let messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = null;
            test.transport.once('connected', () => { connectedEvent = true; });
            test.transport.once('message', message => { messageEvent = message; });
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
          const message = {
            type: 'update'
          };

          let connectedEvent;
          let messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = null;
            test.transport.once('connected', () => { connectedEvent = true; });
            test.transport.once('message', message => { messageEvent = message; });
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
        let connectedEvent;
        let messageEvent;

        beforeEach(() => {
          test.receiveRequest({ type: 'disconnected' });
          test.transitions = [];
          connectedEvent = false;
          messageEvent = false;
          test.transport.once('connected', () => { connectedEvent = true; });
          test.transport.once('message', () => { messageEvent = true; });
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
        let eventEmitted;

        beforeEach(() => {
          test.connect();
          test.transport.sync();
          test.transitions = [];
          eventEmitted = false;
          test.transport.once('connected', () => { eventEmitted = true; });
          test.transport.once('message', () => { eventEmitted = true; });
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
      const evtPayloads = [
        [],
        [{ body: '{ "type": "error", "code": 12345 "message": "foo bar" }' }],
        [{ body: '{ "type": "error", "code": 12345, "message": "foo bar" }' }],
        [{ headers: { 'X-Twilio-Error': [{ raw: '67890 bar baz' }] } }],
        [null, 'Request Timeout'],
        [null, 'Connection Error']
      ];

      let evtPayloadsIdx = 0;
      let eventEmitted;

      function setupTest() {
        test.transitions = [];
        eventEmitted = false;
        test.transport.once('connected', () => { eventEmitted = true; });
        test.transport.once('message', () => { eventEmitted = true; });
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
        let disconnect;
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
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingIncomingMessageInvalidError();
          assert(error instanceof SignalingIncomingMessageInvalidError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when event payload has an error body', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 12345);
          assert.equal(error.message, 'foo bar');
        });

        it('should call #disconnect() with TwilioError when event payload has an error header', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 67890);
          assert.equal(error.message, 'bar baz');
        });

        it('should call #disconnect() with TwilioError when cause is "Request Timeout"', () => {
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingConnectionTimeoutError();
          assert(error instanceof SignalingConnectionTimeoutError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when cause is "Connection Error"', () => {
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingConnectionError();
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
          const message = {
            type: 'connected'
          };

          let emittedEvent;

          beforeEach(() => {
            emittedEvent = null;
            test.transport.once('message', message => { emittedEvent = message; });
            test.receiveRequest(message);
          });

          it('emits an "message" event with the RSP message', () => {
            assert.deepEqual(message, emittedEvent);
          });
        });

        context('"disconnected"', () => {
          const message = {
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

        context('"disconnected" with status "completed"', () => {
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'disconnected', status: 'completed' }, 'info');
          });

          it('calls #disconnect() with a TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof RoomCompletedError);
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error"', () => {
          const message = {
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
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error', code: 12345, message: 'foo bar' }, 'info');
          });

          it('calls #disconnect() with a TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 12345);
            assert.equal(error.message, 'foo bar');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with code and message in the response header', () => {
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Error': '67890 bar baz' });
          });

          it('calls #disconnect() with a TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 67890);
            assert.equal(error.message, 'bar baz');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with no code or message in either the body or the header', () => {
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Foo': '12345 foo bar' });
          });

          it('calls #disconnect() with a unknown TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 0);
            assert.equal(error.message, 'Unknown error');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"synced"', () => {
          const message = {
            type: 'synced'
          };

          let emittedEvent;

          beforeEach(() => {
            emittedEvent = null;
            test.transport.once('message', message => { emittedEvent = message; });
            test.receiveRequest(message);
          });

          it('emits an "message" event with the RSP message', () => {
            assert.deepEqual(message, emittedEvent);
          });
        });

        context('"update"', () => {
          const message = {
            type: 'update'
          };

          let emittedEvent;

          beforeEach(() => {
            emittedEvent = null;
            test.transport.once('message', message => { emittedEvent = message; });
            test.receiveRequest(message);
          });

          it('emits an "message" event with the RSP message', () => {
            assert.deepEqual(message, emittedEvent);
          });
        });
      });

      context('"connecting", and the request contains an RSP message with type', () => {
        context('"connected"', () => {
          const message = {
            type: 'connected'
          };

          let connectedEvent;
          let messageEvent;

          beforeEach(() => {
            connectedEvent = null;
            messageEvent = false;
            test.transport.once('connected', message => { connectedEvent = message; });
            test.transport.once('message', () => { messageEvent = true; });
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
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error', code: 12345, message: 'foo bar' }, 'info');
          });

          it('calls #disconnect() with a TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 12345);
            assert.equal(error.message, 'foo bar');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with code and message in the response header', () => {
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Error': '67890 bar baz' });
          });

          it('calls #disconnect() with a TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 67890);
            assert.equal(error.message, 'bar baz');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with no code or message in either the body or the header', () => {
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Foo': '12345 foo bar' });
          });

          it('calls #disconnect() with a unknown TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 0);
            assert.equal(error.message, 'Unknown error');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"synced"', () => {
          const message = {
            type: 'synced'
          };

          let connectedEvent;
          let messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = false;
            test.transport.once('connected', () => { connectedEvent = true; });
            test.transport.once('message', message => { messageEvent = message; });
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
          const message = {
            type: 'update'
          };

          let connectedEvent;
          let messageEvent;

          beforeEach(() => {
            connectedEvent = false;
            messageEvent = false;
            test.transport.once('connected', () => { connectedEvent = true; });
            test.transport.once('message', message => { messageEvent = message; });
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
        let eventEmitted;

        beforeEach(() => {
          test.transport.disconnect();
          test.transitions = [];
          eventEmitted = false;
          test.transport.once('connected', () => { eventEmitted = true; });
          test.transport.once('message', () => { eventEmitted = true; });
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
          const message = {
            type: 'connected'
          };

          let connectedEvent;
          let messageEvents;

          beforeEach(() => {
            connectedEvent = false;
            messageEvents = [];
            test.transport.once('connected', () => { connectedEvent = true; });
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
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error', code: 12345, message: 'foo bar' }, 'info');
          });

          it('calls #disconnect() with a TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 12345);
            assert.equal(error.message, 'foo bar');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with code and message in the response header', () => {
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Error': '67890 bar baz' });
          });

          it('calls #disconnect() with a TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 67890);
            assert.equal(error.message, 'bar baz');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"error" with no code or message in either the body or the header', () => {
          let disconnect;

          beforeEach(() => {
            disconnect = test.transport.disconnect;
            test.transport.disconnect = sinon.spy();
            test.receiveRequest({ type: 'error' }, 'info', { 'X-Twilio-Foo': '12345 foo bar' });
          });

          it('calls #disconnect() with a unknown TwilioError', () => {
            const error = test.transport.disconnect.args[0][0];
            assert(error instanceof TwilioError);
            assert.equal(error.code, 0);
            assert.equal(error.message, 'Unknown error');
          });

          afterEach(() => {
            test.transport.disconnect = disconnect;
          });
        });

        context('"synced"', () => {
          const message = {
            type: 'synced'
          };

          let messageEvent;

          beforeEach(() => {
            messageEvent = false;
            test.transport.once('message', message => { messageEvent = message; });
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
          const message = {
            type: 'update'
          };

          let connectedEvent;
          let messageEvents;

          beforeEach(() => {
            connectedEvent = false;
            messageEvents = [];
            test.transport.once('connected', () => { connectedEvent = true; });
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
      const evtPayloads = [
        [],
        [{ body: '{ "type": "error", "code": 12345 "message": "foo bar" }' }],
        [{ body: '{ "type": "error", "code": 12345, "message": "foo bar" }' }],
        [{ headers: { 'X-Twilio-Error': [{ raw: '67890 bar baz' }] } }],
        [null, 'Request Timeout'],
        [null, 'Connection Error'],
        [{ body: '{ "type": "disconnected", "status": "completed" }' }],
      ];

      let evtPayloadsIdx = 0;

      context('"connected"', () => {
        let disconnect;

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
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingIncomingMessageInvalidError();
          assert(error instanceof SignalingIncomingMessageInvalidError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when event payload has an error body', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 12345);
          assert.equal(error.message, 'foo bar');
        });

        it('should call #disconnect() with TwilioError when event payload has an error header', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 67890);
          assert.equal(error.message, 'bar baz');
        });

        it('should call #disconnect() with TwilioError when cause is "Request Timeout"', () => {
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingConnectionTimeoutError();
          assert(error instanceof SignalingConnectionTimeoutError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when cause is "Connection Error"', () => {
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingConnectionError();
          assert(error instanceof SignalingConnectionError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with RoomCompletedError when type is "disconnected" and status is "completed"', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof RoomCompletedError);
        });

        afterEach(() => {
          if (evtPayloadsIdx > 0) {
            test.transport.disconnect = disconnect;
          }
          evtPayloadsIdx = (evtPayloadsIdx + 1) % evtPayloads.length;
        });
      });

      context('"connecting"', () => {
        let disconnect;

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
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingIncomingMessageInvalidError();
          assert(error instanceof SignalingIncomingMessageInvalidError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when event payload has an error body', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 12345);
          assert.equal(error.message, 'foo bar');
        });

        it('should call #disconnect() with TwilioError when event payload has an error header', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 67890);
          assert.equal(error.message, 'bar baz');
        });

        it('should call #disconnect() with TwilioError when cause is "Request Timeout"', () => {
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingConnectionTimeoutError();
          assert(error instanceof SignalingConnectionTimeoutError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when cause is "Connection Error"', () => {
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingConnectionError();
          assert(error instanceof SignalingConnectionError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with RoomCompletedError when type is "disconnected" and status is "completed"', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof RoomCompletedError);
        });

        afterEach(() => {
          if (evtPayloadsIdx > 0) {
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
        let disconnect;

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
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingIncomingMessageInvalidError();
          assert(error instanceof SignalingIncomingMessageInvalidError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when event payload has an error body', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 12345);
          assert.equal(error.message, 'foo bar');
        });

        it('should call #disconnect() with TwilioError when event payload has an error header', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof TwilioError);
          assert.equal(error.code, 67890);
          assert.equal(error.message, 'bar baz');
        });

        it('should call #disconnect() with TwilioError when cause is "Request Timeout"', () => {
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingConnectionTimeoutError();
          assert(error instanceof SignalingConnectionTimeoutError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with TwilioError when cause is "Connection Error"', () => {
          const error = test.transport.disconnect.args[0][0];
          const expectedError = new SignalingConnectionError();
          assert(error instanceof SignalingConnectionError);
          assert.equal(error.code, expectedError.code);
          assert.equal(error.message, expectedError.message);
        });

        it('should call #disconnect() with RoomCompletedError when type is "disconnected" and status is "completed"', () => {
          const error = test.transport.disconnect.args[0][0];
          assert(error instanceof RoomCompletedError);
        });

        afterEach(() => {
          if (evtPayloadsIdx > 0) {
            test.transport.disconnect = disconnect;
          }
          evtPayloadsIdx = (evtPayloadsIdx + 1) % evtPayloads.length;
        });
      });
    });
  });

  describe('the underlying SIP.js UA emits', () => {
    describe('"disconnected", and the Transport\'s .state is', () => {
      let test;

      beforeEach(() => {
        test = makeTest();
        test.connect();
      });

      describe('"connected"', () => {
        it('emits "disconnected" with a SignalingConnectionDisconnectedError', () => {
          let state;
          let error;
          test.transport.once('stateChanged', (_state, _error) => {
            state = _state;
            error = _error;
          });
          test.ua.emit('disconnected');
          assert.equal(state, 'disconnected');
          assert(error instanceof SignalingConnectionDisconnectedError);
        });
      });

      describe('"disconnected"', () => {
        beforeEach(() => {
          test.transport.disconnect();
        });

        it('does not emit "disconnected"', () => {
          let didEmitEvent = false;
          test.transport.once('stateChanged', () => { didEmitEvent = true; });
          test.ua.emit('disconnected');
          assert(!didEmitEvent);
        });
      });
    });

    describe('"keepAliveTimeout", and the Transport\'s .state is', () => {
      let test;

      beforeEach(() => {
        test = makeTest();
        test.connect();
      });

      describe('"connected"', () => {
        it('emits "disconnected" with a SignalingConnectionTimeoutError', () => {
          let state;
          let error;
          test.transport.once('stateChanged', (_state, _error) => {
            state = _state;
            error = _error;
          });
          test.ua.emit('keepAliveTimeout');
          assert.equal(state, 'disconnected');
          assert(error instanceof SignalingConnectionTimeoutError);
        });
      });

      describe('"disconnected"', () => {
        beforeEach(() => {
          test.transport.disconnect();
        });

        it('does not emit "disconnected"', () => {
          let didEmitEvent = false;
          test.transport.once('stateChanged', () => { didEmitEvent = true; });
          test.ua.emit('keepAliveTimeout');
          assert(!didEmitEvent);
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
  options.InsightsPublisher = options.InsightsPublisher || makeInsightsPublisherConstructor(options);
  options.NullInsightsPublisher = options.NullInsightsPublisher || makeInsightsPublisherConstructor(options);
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
      headers_[name] = [{ raw: headers[name] }];
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
  const localParticipant = {};
  localParticipant.getState = sinon.spy(() => options.localParticipantState);
  return localParticipant;
}

function makePeerConnectionManager() {
  return {};
}

function makeSession(options) {
  options.sendRequest = options.sendRequest || (() => {});
  const session = new EventEmitter();
  session.terminate = sinon.spy(() => {});
  session.sendReinvite = sinon.spy(() => {});
  session.sendRequest = sinon.spy(options.sendRequest);
  return session;
}

function makeUA(options) {
  const ua = new EventEmitter();
  ua.invite = sinon.spy(() => options.session);
  ua.once = sinon.spy(ua.once.bind(ua));
  ua.stop = sinon.spy(() => {});
  return ua;
}

function makeInsightsPublisherConstructor(testOptions) {
  return function InsightsPublisher() {
    this.disconnect = sinon.spy(() => {});
    this.publish = sinon.spy(() => 'baz');
    testOptions.eventPublisher = this;
  };
}

function makeSIPJSMediaHandlerConstructor(testOptions) {
  return function SIPJSMediaHandler(peerConnectionManager, createMessage) {
    this.peerConnectionManager = peerConnectionManager;
    this.createMessage = createMessage;
    testOptions.mediaHandler = this;
    return this;
  };
}
