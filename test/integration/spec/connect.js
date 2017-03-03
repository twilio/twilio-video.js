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
    return connect(aliceToken, { logLevel: 'foo' }).then(() => {
      throw new Error('Unexpectedly resolved!');
    }, error => {
      assert(error instanceof RangeError);
      assert(/level must be one of/.test(error.message));
    });
  });

  it('should be cancelable', function(done) {
    var cancelablePromise = connect(aliceToken, options);
    cancelablePromise.cancel().then(() => done(new Error('Unexpected resolution')), () => done());
  });

  context('when called without a Room name', () => {
    it('should connect bob and charlie to different Rooms', () => {
      return connect(bobToken, options).then((_bobRoom) => {
        bobRoom = _bobRoom;
        return connect(charlieToken);
      }).then((_charlieRoom) => {
        charlieRoom = _charlieRoom;
        assert.notEqual(charlieRoom.sid, bobRoom.sid);
      });
    });
  });

  context('when called with the same Room name', () => {
    it('should connect bob and charlie to the same Room', () => {
      return connect(bobToken, Object.assign({ name: 'foo' }, options)).then((_bobRoom) => {
        bobRoom = _bobRoom;
        return connect(charlieToken, Object.assign({ name: 'foo' }, options));
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
