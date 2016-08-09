'use strict';

var assert = require('assert');

var Client = require('../../../lib/client');
var LocalMedia = require('../../../lib/media/localmedia');

var credentials = require('../../env');
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

describe('Room', function() {
  var aliceName = randomName();
  var aliceToken = getToken({ address: aliceName });
  var alice = null;

  var roomName = null;
  var room = null;

  var options = {};
  if (wsServer) {
    options.wsServer = wsServer;
  }
  options['logLevel'] = 'debug';

  var localMedia = new LocalMedia();

  describe('constructor', function() {
    before(function setupClient(done) {
      this.timeout(10000);
      roomName = randomName();
      alice = new Client(aliceToken, options);

      return alice.connect({ to: roomName }).then(_room => {
        room = _room;
        done();
      }, done);
    });

    it('should set the .sid property', function() {
      assert(room.sid);
    });

    it('should set the .localParticipant property', function() {
      assert(room.localParticipant);
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
