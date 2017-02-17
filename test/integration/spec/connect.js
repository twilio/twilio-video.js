'use strict';

var assert = require('assert');
var connect = require('../../../lib/connect');
var credentials = require('../../env');
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var logLevel = credentials.logLevel;
var wsServer = credentials.wsServer;

describe('connect', function() {
  var aliceName = randomName();
  var aliceToken = getToken({ address: aliceName });
  var bobName = randomName();
  var bobToken = getToken({ address: bobName });
  var charlieName = randomName();
  var charlieToken = getToken({ address: charlieName });
  var bobRoom = null;
  var charlieRoom = null;

  var options = {
    debug: false
  };

  if (wsServer) {
    options.wsServer = wsServer;
  }
  if (logLevel) {
    options.logLevel = logLevel;
  }

  it('should reject if logLevel is invalid', function() {
    return new Promise((resolve, reject) => {
      connect({ token: aliceToken, logLevel: 'foo' }).then(reject, error => {
        try {
          assert(error instanceof RangeError);
          assert(/level must be one of/.test(error.message));
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });

  it('should be cancelable', function(done) {
    var cancelablePromise = connect(Object.assign({ token: aliceToken }, options));
    cancelablePromise.cancel().then(() => done(new Error('Unexpected resolution')), () => done());
  });

  context('when called without a Room name', () => {
    it('should connect bob and charlie to different Rooms', () => {
      connect(Object.assign({ token: bobToken }, options)).then((_bobRoom) => {
        bobRoom = _bobRoom;
        return connect({ token: charlieToken });
      }).then((_charlieRoom) => {
        charlieRoom = _charlieRoom;
        assert.notEqual(charlieRoom.sid, bobRoom.sid);
      });
    });
  });

  context('when called with the same Room name', () => {
    it('should connect bob and charlie to the same Room', () => {
      connect(Object.assign({ token: bobToken, name: 'foo' }, options)).then((_bobRoom) => {
        bobRoom = _bobRoom;
        return connect(Object.assign({ token: charlieToken, name: 'foo' }, options));
      }).then((_charlieRoom) => {
        charlieRoom = _charlieRoom;
        assert.equal(charlieRoom.sid, bobRoom.sid);
      });
    });
  });

  after(() => {
    if (bobRoom) {
      bobRoom.disconnect();
    }
    if (charlieRoom) {
      charlieRoom.disconnect();
    }
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
