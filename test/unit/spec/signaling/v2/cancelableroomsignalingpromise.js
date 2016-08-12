'use strict';

var assert = require('assert');
var CancelablePromise = require('../../../../../lib/util/cancelablepromise');
var createCancelableRoomSignalingPromise = require('../../../../../lib/signaling/v2/cancelableroomsignalingpromise');
var EventEmitter = require('events').EventEmitter;
var sinon = require('sinon');
var util = require('../../../../../lib/util');

describe('createCancelableRoomSignalingPromise', () => {
  it('returns a CancelablePromise', () => {
    var test = makeTest();
    assert(test.cancelableRoomSignalingPromise instanceof CancelablePromise);
  });

  it('constructs a new PeerConnectionManager', () => {
    var test = makeTest();
    assert(test.peerConnectionManager);
  });

  it('calls .setConfiguration on the newly-constructed PeerConnectionManager', () => {
    var test = makeTest();
    assert(test.peerConnectionManager.setConfiguration.calledOnce);
  });

  it('calls .addMediaStream with the LocalParticipantSignaling\'s Tracks\' MediaStreams on the newly-constructed PeerConnectionManager', () => {
    var mediaStreamTrack1 = {
      mediaStream: {}
    };
    var mediaStreamTrack2 = {
      mediaStream: {}
    };
    var test = makeTest({
      tracks: [
        mediaStreamTrack1,
        mediaStreamTrack2
      ]
    });
    assert.equal(
      mediaStreamTrack1.mediaStream,
      test.peerConnectionManager.addMediaStream.args[0][0]);
    assert.equal(
      mediaStreamTrack2.mediaStream,
      test.peerConnectionManager.addMediaStream.args[1][0]);
  });

  it('calls .createAndOffer on the newly-constructed PeerConnectionManager', () => {
    var test = makeTest();
    assert(test.peerConnectionManager.createAndOffer.calledOnce);
  });

  context('when the CancelablePromise is canceled before .createAndOffer resolves', () => {
    it('the CancelablePromise rejects with a cancelation Error', () => {
      var test = makeTest();
      test.cancelableRoomSignalingPromise.cancel();
      var promise = test.cancelableRoomSignalingPromise.then(() => {
        throw new Error('Unexpected resolution');
      }, error => {
        assert.equal(
          'Canceled',
          error.message);
      });
      test.createAndOfferDeferred.resolve();
      return promise;
    });

    it('calls .close on the PeerConnectionManager', () => {
      var test = makeTest();
      test.cancelableRoomSignalingPromise.cancel();
      var promise = test.cancelableRoomSignalingPromise.then(() => {
        throw new Error('Unexpected resolution');
      }, error => {
        assert(test.peerConnectionManager.close.calledOnce);
      });
      test.createAndOfferDeferred.resolve();
      return promise;
    });
  });

  it('calls .invite on the SIP.js UserAgent', () => {
    var test = makeTest();
    test.createAndOfferDeferred.resolve();
    return test.createAndOfferDeferred.promise.then(() => {
      assert(test.ua.invite.calledOnce);
    });
  });

  context('when it calls .invite on the SIP.js UserAgent', () => {
    it('sets the target to "sip:orchestrator@${ACCOUNT_SID}.endpoint.twilio.com"', () => {
      var test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        assert.equal(
          'sip:orchestrator@' + test.accountSid + '.endpoint.twilio.com',
          test.ua.invite.args[0][0]);
      });
    });

    it('sets the X-Twilio-AccessToken header to the Access Token', () => {
      var test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        for (var header of test.ua.invite.args[0][1].extraHeaders) {
          if (header.startsWith('X-Twilio-AccessToken: ')) {
            assert.equal(
              'X-Twilio-AccessToken: ' + test.token,
              header);
            return;
          }
        }
        throw new Error('X-Twilio-AccessToken header missing');
      });
    });

    it('sets the Session-Expires header to 120', () => {
      var test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        for (var header of test.ua.invite.args[0][1].extraHeaders) {
          if (header.startsWith('Session-Expires: ')) {
            assert.equal(
              'Session-Expires: 120',
              header);
            return;
          }
        }
        throw new Error('Session-Expires header missing');
      });
    });

    it('sets a mediaHandlerFactory that returns a SIPJSMediaHandler', () => {
      var test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        var mediaHandlerFactory = test.ua.invite.args[0][1].mediaHandlerFactory;
        assert(mediaHandlerFactory());
      });
    });

    context('the SIPJSMediaHandler', () => {
      it('receives the PeerConnectionManager', () => {
        var test = makeTest();
        test.createAndOfferDeferred.resolve();
        return test.createAndOfferDeferred.promise.then(() => {
          var mediaHandlerFactory = test.ua.invite.args[0][1].mediaHandlerFactory;
          assert.equal(
            test.peerConnectionManager,
            mediaHandlerFactory().peerConnectionManager);
        });
      });

      it('receives a createConnectMessage function', () => {
        var name = makeName();
        var test = makeTest({
          create: true,
          to: name
        });
        test.createAndOfferDeferred.resolve();
        return test.createAndOfferDeferred.promise.then(() => {
          var mediaHandlerFactory = test.ua.invite.args[0][1].mediaHandlerFactory;
          assert.deepEqual(
            {
              create: true,
              name: name,
              participant: test.localParticipant.getState(),
              type: 'connect',
              version: 1
            },
            mediaHandlerFactory().createConnectMessage());
        });
      });
    });

    it('sets an infoHandler to emit "info" events in response to INFO messages', () => {
      var test = makeTest();
      var info;
      test.session.once('info', request => info = request);
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        var infoHandler = test.ua.invite.args[0][1].infoHandler;
        var request = { reply: () => {} };
        infoHandler.call(test.session, request);
        assert.equal(info, request);
      });
    });

    it('sets an infoHandler to reply 200 OK in response to INFO messages', () => {
      var test = makeTest();
      var info;
      test.session.once('info', request => info = request);
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        var infoHandler = test.ua.invite.args[0][1].infoHandler;
        var request = { reply: sinon.spy(() => {}) };
        infoHandler.call(test.session, request);
        assert.equal(
          200,
          request.reply.args[0][0]);
      });
    });
  });

  context('when the SIP.js Session emits an "accepted" event', () => {
    context('and the CancelablePromise was canceled', () => {
      it('the CancelablePromise rejects with a cancelation error', () => {
        var test = makeTest();
        test.createAndOfferDeferred.resolve();
        return test.createAndOfferDeferred.promise.then(() => {
          test.cancelableRoomSignalingPromise.cancel();
          test.session.emit('accepted');
          return test.cancelableRoomSignalingPromise.then(() => {
            throw new Error('Unexpected resolution');
          }, error => {
            assert.equal(
              'Canceled',
              error.message);
          });
        });
      });

      it('calls .terminate on the SIP.js Session', () => {
        var test = makeTest();
        test.createAndOfferDeferred.resolve();
        return test.createAndOfferDeferred.promise.then(() => {
          test.cancelableRoomSignalingPromise.cancel();
          test.session.emit('accepted');
          return test.cancelableRoomSignalingPromise.then(() => {
            throw new Error('Unexpected resolution');
          }, error => {
            assert(test.session.terminate.calledOnce);
          });
        });
      });

      it('calls .close on the PeerConnectionManager', () => {
        var test = makeTest();
        test.createAndOfferDeferred.resolve();
        return test.createAndOfferDeferred.promise.then(() => {
          test.cancelableRoomSignalingPromise.cancel();
          test.session.emit('accepted');
          return test.cancelableRoomSignalingPromise.then(() => {
            throw new Error('Unexpected resolution');
          }, error => {
            assert(test.peerConnectionManager.close.calledOnce);
          });
        });
      });
    });

    context('and the CancelablePromise was not canceled', () => {
      context('and the accepted response body is valid JSON', () => {
        context('but the .participant property is missing', () => {
          it('the CancelablePromise rejects with an error', () => {
            var test = makeTest();
            test.createAndOfferDeferred.resolve();
            return test.createAndOfferDeferred.promise.then(() => {
              test.session.emit('accepted', { body: '{}' });
              return test.cancelableRoomSignalingPromise.then(() => {
                throw new Error('Unexpected resolution');
              }, error => {
                // Do nothing.
              });
            });
          });

          it('calls .terminate on the SIP.js Session', () => {
            var test = makeTest();
            test.createAndOfferDeferred.resolve();
            return test.createAndOfferDeferred.promise.then(() => {
              test.session.emit('accepted', { body: '{}' });
              return test.cancelableRoomSignalingPromise.then(() => {
                throw new Error('Unexpected resolution');
              }, error => {
                assert(test.session.terminate.calledOnce);
              });
            });
          });

          it('calls .close on the PeerConnectionManager', () => {
            var test = makeTest();
            test.createAndOfferDeferred.resolve();
            return test.createAndOfferDeferred.promise.then(() => {
              test.session.emit('accepted', { body: '{}' });
              return test.cancelableRoomSignalingPromise.then(() => {
                throw new Error('Unexpected resolution');
              }, error => {
                assert(test.peerConnectionManager.close.calledOnce);
              });
            });
          });
        });

        context('and the .participant property is present', () => {
          it('calls .connect with the .participant\'s .sid and .identity on the LocalParticipantSignaling', () => {
            var test = makeTest();
            test.createAndOfferDeferred.resolve();
            return test.createAndOfferDeferred.promise.then(() => {
              var identity = makeIdentity();
              var sid = makeParticipantSid();
              test.session.emit('accepted', {
                body: JSON.stringify({
                  participant: {
                    sid: sid,
                    identity: identity
                  }
                })
              });
              assert.equal(
                sid,
                test.localParticipant.connect.args[0][0]);
              assert.equal(
                identity,
                test.localParticipant.connect.args[0][1]);
            });
          });

          it('constructs a new RoomV2', () => {
            var test = makeTest();
            test.createAndOfferDeferred.resolve();
            return test.createAndOfferDeferred.promise.then(() => {
              var identity = makeIdentity();
              var sid = makeParticipantSid();
              test.session.emit('accepted', {
                body: JSON.stringify({
                  participant: {
                    sid: sid,
                    identity: identity
                  }
                })
              });
              assert(test.RoomV2.calledOnce);
            });
          });

          context('when the CancelablePromise has not been canceled', () => {
            it('the CancelablePromise resolves to the newly-constructed RoomV2', () => {
              var test = makeTest();
              test.createAndOfferDeferred.resolve();
              test.createAndOfferDeferred.promise.then(() => {
                var identity = makeIdentity();
                var sid = makeParticipantSid();
                test.session.emit('accepted', {
                  body: JSON.stringify({
                    participant: {
                      sid: sid,
                      identity: identity
                    }
                  })
                });
              });
              return test.cancelableRoomSignalingPromise.then(room => {
                assert.equal(test.room, room);
              });
            });
          });

          context('when the CancelablePromise has been canceled', () => {
            it('the CancelablePromise rejects with a cancelation error', () => {
              var test = makeTest();
              test.createAndOfferDeferred.resolve();
              test.createAndOfferDeferred.promise.then(() => {
                var identity = makeIdentity();
                var sid = makeParticipantSid();
                test.session.emit('accepted', {
                  body: JSON.stringify({
                    participant: {
                      sid: sid,
                      identity: identity
                    }
                  })
                });
                test.cancelableRoomSignalingPromise.cancel();
              });
              return test.cancelableRoomSignalingPromise.then(() => {
                throw new Error('Unexpected resolution');
              }, error => {
                assert.equal(
                  'Canceled',
                  error.message);
              });
            });

            it('calls .disconnect on the newly-constructed RoomV2', () => {
              var test = makeTest();
              test.createAndOfferDeferred.resolve();
              test.createAndOfferDeferred.promise.then(() => {
                var identity = makeIdentity();
                var sid = makeParticipantSid();
                test.session.emit('accepted', {
                  body: JSON.stringify({
                    participant: {
                      sid: sid,
                      identity: identity
                    }
                  })
                });
                test.cancelableRoomSignalingPromise.cancel();
              });
              return test.cancelableRoomSignalingPromise.then(() => {
                throw new Error('Unexpected resolution');
              }, error => {
                assert(test.room.disconnect.calledOnce);
              });
            });

            it('does not call .terminate on the SIP.js Session', () => {
              var test = makeTest();
              test.createAndOfferDeferred.resolve();
              test.createAndOfferDeferred.promise.then(() => {
                var identity = makeIdentity();
                var sid = makeParticipantSid();
                test.session.emit('accepted', {
                  body: JSON.stringify({
                    participant: {
                      sid: sid,
                      identity: identity
                    }
                  })
                });
                test.cancelableRoomSignalingPromise.cancel();
              });
              return test.cancelableRoomSignalingPromise.then(() => {
                throw new Error('Unexpected resolution');
              }, error => {
                assert(!test.session.terminate.calledOnce);
              });
            });

            it('calls .close on the PeerConnectionManager', () => {
              var test = makeTest();
              test.createAndOfferDeferred.resolve();
              test.createAndOfferDeferred.promise.then(() => {
                var identity = makeIdentity();
                var sid = makeParticipantSid();
                test.session.emit('accepted', {
                  body: JSON.stringify({
                    participant: {
                      sid: sid,
                      identity: identity
                    }
                  })
                });
                test.cancelableRoomSignalingPromise.cancel();
              });
              return test.cancelableRoomSignalingPromise.then(() => {
                throw new Error('Unexpected resolution');
              }, error => {
                assert(test.peerConnectionManager.close.calledOnce);
              });
            });
          });
        });
      });

      context('and the accepted response body is not valid JSON', () => {
        it('the CancelablePromise rejects with an error', () => {
          var test = makeTest();
          test.createAndOfferDeferred.resolve();
          return test.createAndOfferDeferred.promise.then(() => {
            test.session.emit('accepted', { body: 'oh, hai' });
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              // Do nothing.
            });
          });
        });

        it('calls .terminate on the SIP.js Session', () => {
          var test = makeTest();
          test.createAndOfferDeferred.resolve();
          return test.createAndOfferDeferred.promise.then(() => {
            test.session.emit('accepted', { body: 'oh, hai' });
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(test.session.terminate.calledOnce);
            });
          });
        });

        it('calls .close on the PeerConnectionManager', () => {
          var test = makeTest();
          test.createAndOfferDeferred.resolve();
          return test.createAndOfferDeferred.promise.then(() => {
            test.session.emit('accepted', { body: 'oh, hai' });
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(test.peerConnectionManager.close.calledOnce);
            });
          });
        });
      });
    });
  });

  context('when the SIP.js Session emits a "failed" event', () => {
    it('the CancelablePromise rejects with an error', () => {
      var test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        test.session.emit('failed');
        return test.cancelableRoomSignalingPromise.then(() => {
          throw new Error('Unexpected resolution');
        }, error => {
          // Do nothing.
        });
      });
    });

    it('does not call .terminate on the SIP.js Session', () => {
      var test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        test.session.emit('failed');
        return test.cancelableRoomSignalingPromise.then(() => {
          throw new Error('Unexpected resolution');
        }, error => {
          assert(!test.session.terminate.calledOnce);
        });
      });
    });

    it('calls .close on the PeerConnectionManager', () => {
      var test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        test.session.emit('failed');
        return test.cancelableRoomSignalingPromise.then(() => {
          throw new Error('Unexpected resolution');
        }, error => {
          assert(test.peerConnectionManager.close.calledOnce);
        });
      });
    });
  });
});

function makeParticipantSid() {
  var sid = 'PA';
  for (var i = 0; i < 32; i++) {
    sid += 'abcdef0123456789'.split('')[Math.floor(Math.random() * 16)];
  }
  return sid;
}

function makeAccountSid() {
  var sid = 'AC';
  for (var i = 0; i < 32; i++) {
    sid += 'abcdef0123456789'.split('')[Math.floor(Math.random() * 16)];
  }
  return sid;
}

function makeName() {
  return Math.random().toString(36).slice(2);
}

function makeIdentity() {
  return Math.random().toString(36).slice(2);
}

function makeToken(options) {
  return new Buffer(JSON.stringify({
    accountSid: options.accountSid
  })).toString('base64');
}

function makeUA(options) {
  return {
    invite: sinon.spy(() => options.session)
  };
}

function makeSession(options) {
  var session = new EventEmitter();
  session.terminate = sinon.spy();
  return session;
}

function makeTest(options) {
  options = options || {};
  options.accountSid = options.accountSid || makeAccountSid();
  options.token = options.token || makeToken(options);
  options.session = options.session || makeSession(options);
  options.ua = options.ua || makeUA(options);
  options.tracks = options.tracks || [];
  options.localParticipant = options.localParticipant || makeLocalParticipantSignaling(options);
  options.createAndOfferDeferred = util.defer();
  options.PeerConnectionManager = options.PeerConnectionManager || makePeerConnectionManagerConstructor(options);
  options.room = options.room || {
    disconnect: sinon.spy(() => {})
  };
  options.RoomV2 = options.RoomV2 || sinon.spy(function RoomV2() { return options.room; });
  options.cancelableRoomSignalingPromise = createCancelableRoomSignalingPromise(
    options.accountSid,
    options.token,
    options.ua,
    options.localParticipant,
    options);
  return options;
}

function makePeerConnectionManagerConstructor(testOptions) {
  return function PeerConnectionManager(options) {
    var peerConnectionManager = new EventEmitter();
    peerConnectionManager.addMediaStream = sinon.spy(() => {});
    peerConnectionManager.close = sinon.spy(() => {});
    peerConnectionManager.setConfiguration = sinon.spy(() => {});
    peerConnectionManager.setMediaStreams = sinon.spy(() => {});
    peerConnectionManager.getRemoteMediaStreams = sinon.spy(() => []);
    peerConnectionManager.update = sinon.spy(() => {});
    peerConnectionManager.createAndOffer = sinon.spy(() => {
      return testOptions.createAndOfferDeferred.promise;
    });
    testOptions.peerConnectionManager = peerConnectionManager;
    return peerConnectionManager;
  }
}

function makeLocalParticipantSignaling(options) {
  var localParticipant = new EventEmitter();
  localParticipant.sid = null;
  localParticipant.identity = null;
  localParticipant.revision = 0;
  localParticipant.getState = sinon.spy(() => ({ revision: localParticipant.revision }));
  localParticipant.update = sinon.spy(() => localParticipant.revision++);
  localParticipant.tracks = options.tracks;
  localParticipant.disconnect = sinon.spy(() => {});
  localParticipant.connect = sinon.spy((sid, identity) => {
    localParticipant.sid = sid;
    localParticipant.identity = identity;
  });
  return localParticipant;
}
