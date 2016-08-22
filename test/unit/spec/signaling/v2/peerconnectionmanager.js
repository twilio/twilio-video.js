'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var PeerConnectionManager = require('../../../../../lib/signaling/v2/peerconnectionmanager');
var sinon = require('sinon');
var util = require('../../../../../lib/util');

describe('PeerConnectionManager', () => {
  describe('#addMediaStream', () => {
    it('returns the PeerConnectionManager', () => {
      var test = makeTest();
      var mediaStream = makeMediaStream();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        assert.equal(
          test.peerConnectionManager,
          test.peerConnectionManager.addMediaStream(mediaStream));
      });
    });

    it('calls addMediaStream on any PeerConnectionV2s created with #createAndOffer or #update', () => {
      var test = makeTest();
      var mediaStream = makeMediaStream();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        test.peerConnectionManager.addMediaStream(mediaStream);
        assert.equal(
          mediaStream,
          test.peerConnectionV2s[0].addMediaStream.args[0][0]);
        assert.equal(
          mediaStream,
          test.peerConnectionV2s[1].addMediaStream.args[0][0]);
      });
    });
  });

  describe('#close', () => {
    it('returns the PeerConnectionManager', () => {
      var test = makeTest();
      var mediaStream = makeMediaStream();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        assert.equal(
          test.peerConnectionManager,
          test.peerConnectionManager.close());
      });
    });

    it('calls close on any PeerConnectionV2s created with #createAndOffer or #update', () => {
      var test = makeTest();
      var mediaStream = makeMediaStream();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        test.peerConnectionManager.close();
        assert(test.peerConnectionV2s[0].close.calledOnce);
        assert(test.peerConnectionV2s[1].close.calledOnce);
      });
    });
  });

  describe('#createAndOffer', () => {
    context('returns a Promise that resolves', () => {
      it('to the PeerConnectionManager', () => {
        var test = makeTest();
        return test.peerConnectionManager.createAndOffer().then(peerConnectionManager => {
          assert.equal(test.peerConnectionManager, peerConnectionManager);
        });
      });

      it('after the PeerConnectionV2 has created an offer', () => {
        var peerConnectionV2 = new EventEmitter();
        var deferred = util.defer();
        peerConnectionV2.offer = () => deferred.promise;
        var test = makeTest({
          RTCPeerConnection: function() { return peerConnectionV2; }
        });
        var createAndOfferResolved = false;
        var promise = test.peerConnectionManager.createAndOffer().then(() => {
          createAndOfferResolved = true;
        });
        return new Promise(resolve => {
          assert(!createAndOfferResolved);
          deferred.resolve();
          resolve(promise);
        });
      });
    });

    it('constructs a new PeerConnectionV2 using the most recent configuration passed to #setConfiguration', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        test.peerConnectionManager.setConfiguration({ baz: 'qux' });
      }).then(() => {
        assert.deepEqual(
          { baz: 'qux' },
          test.peerConnectionV2s[0].configuration);
      });
    });

    it('calls addMediaStream with any previously-added MediaStreams on the new PeerConnectionV2', () => {
      var test = makeTest();
      var mediaStream = makeMediaStream();
      test.peerConnectionManager.addMediaStream(mediaStream);
      return test.peerConnectionManager.createAndOffer().then(() => {
        assert.equal(
          mediaStream,
          test.peerConnectionV2s[0].addMediaStream.args[0][0]);
      });
    });
  });

  describe('#getRemoteMediaStreams', () => {
    it('returns the concatenated results of calling getRemoteMediaStreams on any PeerConnectionV2s create with #createAndOffer or #update', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        var mediaStream1 = makeMediaStream();
        var mediaStream2 = makeMediaStream();
        test.peerConnectionV2s[0].getRemoteMediaStreams = () => [mediaStream1];
        test.peerConnectionV2s[1].getRemoteMediaStreams = () => [mediaStream2];
        assert.deepEqual(
          [mediaStream1, mediaStream2],
          test.peerConnectionManager.getRemoteMediaStreams());
      });
    });
  });

  describe('#getStates', () => {
    it('returns the non-null results of calling getState on any PeerConnectionV2s created with #createAndOffer or #update', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        test.peerConnectionV2s[0].getState = () => null;
        assert.deepEqual(
          [
            { id: '123', fizz: 'buzz' }
          ],
          test.peerConnectionManager.getStates());
      });
    });
  });

  describe('#removeMediaStream', () => {
    context('when the MediaStream to remove was previously added via addMediaStream', () => {
      it('returns true', () => {
        var test = makeTest();
        var mediaStream = makeMediaStream();
        test.peerConnectionManager.addMediaStream(mediaStream);
        return test.peerConnectionManager.createAndOffer().then(() => {
          return test.peerConnectionManager.update([
            { id: '123' }
          ]);
        }).then(() => {
          assert(test.peerConnectionManager.removeMediaStream(mediaStream));
        });
      });

      it('calls removeMediaStream on any PeerConnectionV2s created with #createAndOffer or #update', () => {
        var test = makeTest();
        var mediaStream = makeMediaStream();
        test.peerConnectionManager.addMediaStream(mediaStream);
        return test.peerConnectionManager.createAndOffer().then(() => {
          return test.peerConnectionManager.update([
            { id: '123' }
          ]);
        }).then(() => {
          test.peerConnectionManager.removeMediaStream(mediaStream);
          assert.equal(
            mediaStream,
            test.peerConnectionV2s[0].removeMediaStream.args[0][0]);
          assert.equal(
            mediaStream,
            test.peerConnectionV2s[1].removeMediaStream.args[0][0]);
        });
      });
    });

    context('when the MediaStream to remove was not previously added via addMediaStream', () => {
      it('returns false', () => {
        var test = makeTest();
        var mediaStream = makeMediaStream();
        return test.peerConnectionManager.createAndOffer().then(() => {
          return test.peerConnectionManager.update([
            { id: '123' }
          ]);
        }).then(() => {
          assert(!test.peerConnectionManager.removeMediaStream(mediaStream));
        });
      });

      it('calls removeMediaStream on any PeerConnectionV2s created with #createAndOffer or #update', () => {
        var test = makeTest();
        var mediaStream = makeMediaStream();
        return test.peerConnectionManager.createAndOffer().then(() => {
          return test.peerConnectionManager.update([
            { id: '123' }
          ]);
        }).then(() => {
          test.peerConnectionManager.removeMediaStream(mediaStream);
          assert.equal(
            mediaStream,
            test.peerConnectionV2s[0].removeMediaStream.args[0][0]);
          assert.equal(
            mediaStream,
            test.peerConnectionV2s[1].removeMediaStream.args[0][0]);
        });
      });
    });
  });

  describe('#setConfiguration', () => {
    it('returns the PeerConnectionManager', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        assert.equal(
          test.peerConnectionManager,
          test.peerConnectionManager.setConfiguration({ foo: 'bar' }));
      });
    });

    it('calls setConfiguration on any PeerConnectionV2s created with #createAndOffer or #update', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        test.peerConnectionManager.setConfiguration({ foo: 'bar' });
        assert.deepEqual(
          { foo: 'bar' },
          test.peerConnectionV2s[0].setConfiguration.args[0][0]);
        assert.deepEqual(
          { foo: 'bar' },
          test.peerConnectionV2s[1].setConfiguration.args[0][0]);
      });
    });
  });

  describe('#setMediaStreams', () => {
    it('returns the PeerConnectionManager', () => {
      var test = makeTest();
      var mediaStream1 = makeMediaStream();
      var mediaStream2 = makeMediaStream();
      var mediaStream3 = makeMediaStream();
      test.peerConnectionManager.addMediaStream(mediaStream1);
      test.peerConnectionManager.addMediaStream(mediaStream2);
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        assert.equal(
          test.peerConnectionManager,
          test.peerConnectionManager.setMediaStreams([mediaStream2, mediaStream3]));
      });
    });

    it('calls removeMediaStream with any previously-added MediaStreams on any PeerConnectionV2s created with #createAndOffer or #update', () => {
      var test = makeTest();
      var mediaStream1 = makeMediaStream();
      var mediaStream2 = makeMediaStream();
      var mediaStream3 = makeMediaStream();
      test.peerConnectionManager.addMediaStream(mediaStream1);
      test.peerConnectionManager.addMediaStream(mediaStream2);
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        test.peerConnectionManager.setMediaStreams([mediaStream2, mediaStream3]);
        assert.equal(
          mediaStream1,
          test.peerConnectionV2s[0].removeMediaStream.args[0][0]);
        assert.equal(
          mediaStream2,
          test.peerConnectionV2s[0].removeMediaStream.args[1][0]);
        assert.equal(
          mediaStream1,
          test.peerConnectionV2s[1].removeMediaStream.args[0][0]);
        assert.equal(
          mediaStream2,
          test.peerConnectionV2s[1].removeMediaStream.args[1][0]);
      });
    });

    it('calls addMediaStream with the new MediaStreams on any PeerConnectionV2s created with #createAndOffer or #update', () => {
      var test = makeTest();
      var mediaStream1 = makeMediaStream();
      var mediaStream2 = makeMediaStream();
      var mediaStream3 = makeMediaStream();
      test.peerConnectionManager.addMediaStream(mediaStream1);
      test.peerConnectionManager.addMediaStream(mediaStream2);
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        test.peerConnectionManager.setMediaStreams([mediaStream2, mediaStream3]);
        assert.equal(
          mediaStream1,
          test.peerConnectionV2s[0].removeMediaStream.args[0][0]);
        assert.equal(
          mediaStream2,
          test.peerConnectionV2s[0].removeMediaStream.args[1][0]);
        assert.equal(
          mediaStream1,
          test.peerConnectionV2s[1].removeMediaStream.args[0][0]);
        assert.equal(
          mediaStream2,
          test.peerConnectionV2s[1].removeMediaStream.args[1][0]);
      });
    });

    context('when the MediaStreamTracks changed', () => {
      it('calls offer on any PeerConnectionV2s created with #createAndOffer or #update', () => {
        var test = makeTest();

        var audioTrack1 = makeMediaStreamTrack({ kind: 'audio' });
        var audioTrack2 = makeMediaStreamTrack({ kind: 'audio' });
        var audioTrack3 = makeMediaStreamTrack({ kind: 'audio' });

        var mediaStream1 = makeMediaStream({
          audio: [audioTrack1]
        });

        var mediaStream2 = makeMediaStream({
          audio: [audioTrack1, audioTrack2]
        });

        var mediaStream3 = makeMediaStream({
          audio: [audioTrack2, audioTrack3]
        });

        test.peerConnectionManager.addMediaStream(mediaStream1);
        test.peerConnectionManager.addMediaStream(mediaStream2);

        return test.peerConnectionManager.createAndOffer().then(() => {
          return test.peerConnectionManager.update([
            { id: '123' }
          ]);
        }).then(() => {
          test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
          test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());

          test.peerConnectionManager.setMediaStreams([mediaStream2, mediaStream3]);

          assert(test.peerConnectionV2s[0].offer.calledOnce);
          assert(test.peerConnectionV2s[1].offer.calledOnce);
        });
      });
    });

    context('when the MediaStreamTracks did not change', () => {
      it('does not call offer on any PeerConnectionV2s created with #createAndOffer or #update', () => {
        var test = makeTest();

        var audioTrack1 = makeMediaStreamTrack({ kind: 'audio' });
        var audioTrack2 = makeMediaStreamTrack({ kind: 'audio' });

        var mediaStream1 = makeMediaStream({
          audio: [audioTrack1]
        });

        var mediaStream2 = makeMediaStream({
          audio: [audioTrack1, audioTrack2]
        });

        var mediaStream3 = makeMediaStream({
          audio: [audioTrack1]
        });

        test.peerConnectionManager.addMediaStream(mediaStream1);
        test.peerConnectionManager.addMediaStream(mediaStream2);

        return test.peerConnectionManager.createAndOffer().then(() => {
          return test.peerConnectionManager.update([
            { id: '123' }
          ]);
        }).then(() => {
          test.peerConnectionV2s[0].offer = sinon.spy(() => Promise.resolve());
          test.peerConnectionV2s[1].offer = sinon.spy(() => Promise.resolve());

          test.peerConnectionManager.setMediaStreams([mediaStream2, mediaStream3]);

          assert(!test.peerConnectionV2s[0].offer.calledOnce);
          assert(!test.peerConnectionV2s[1].offer.calledOnce);
        });
      });
    });
  });

  describe('#update', () => {
    context('when called with an array of PeerConnection states containing a new PeerConnection ID', () => {
      it('returns a Promise for the PeerConnectionManager', () => {
        var test = makeTest();
        return test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]).then(peerConnectionManager => {
          assert.equal(test.peerConnectionManager, peerConnectionManager);
        });
      });

      it('constructs a new PeerConnectionV2 with the new PeerConnection ID using the most recent configuration passed to #setConfiguration', () => {
        var test = makeTest();
        return test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]).then(() => {
          assert.equal('123', test.peerConnectionV2s[0].id);
          assert.deepEqual(
            { iceServers: [] },
            test.peerConnectionV2s[0].configuration);
        });
      });

      it('calls addMediaStream with any previously-added MediaStreams on the new PeerConnectionV2', () => {
        var test = makeTest();
        var mediaStream = makeMediaStream();
        test.peerConnectionManager.addMediaStream(mediaStream);
        return test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]).then(() => {
          assert.equal(
            mediaStream,
            test.peerConnectionV2s[0].addMediaStream.args[0][0]);
        });
      });

      it('passes the PeerConnection states to the new PeerConnectionV2\'s #update method', () => {
        var test = makeTest();
        return test.peerConnectionManager.update([
          { id: '123', fizz: 'buzz' }
        ]).then(() => {
          assert.deepEqual(
            { id: '123', fizz: 'buzz' },
            test.peerConnectionV2s[0].update.args[0][0]);
        });
      });
    });

    context('when called with an array of PeerConnection states containing known PeerConnection IDs', () => {
      it('returns a Promise for the PeerConnectionManager', () => {
        var test = makeTest();
        return test.peerConnectionManager.createAndOffer().then(() => {
          var peerConnectionState = {
            id: test.peerConnectionV2s[0].id,
            fizz: 'buzz'
          };
          return test.peerConnectionManager.update([peerConnectionState]);
        }).then(peerConnectionManager => {
          assert.equal(test.peerConnectionManager, peerConnectionManager);
        });
      });

      it('passes the PeerConnection states to the corresponding PeerConnectionV2\'s #update method', () => {
        var test = makeTest();
        return test.peerConnectionManager.createAndOffer().then(() => {
          var peerConnectionState = {
            id: test.peerConnectionV2s[0].id,
            fizz: 'buzz'
          };
          return test.peerConnectionManager.update([peerConnectionState]);
        }).then(() => {
          assert.deepEqual(
            {
              id: test.peerConnectionV2s[0].id,
              fizz: 'buzz'
            },
            test.peerConnectionV2s[0].update.args[0][0]);
        });
      });
    });

    context('when it is called more than once for the same id', () => {
      it('should result in the PeerConnection having only one listener for \'stateChanged\'', () => {
        var test = makeTest();
        return test.peerConnectionManager.createAndOffer().then(() => {
          var peerConnectionState = {
            id: test.peerConnectionV2s[0].id,
            fizz: 'buzz'
          };
          return test.peerConnectionManager.update([peerConnectionState]);
        }).then(() => {
          var peerConnectionState = {
            id: test.peerConnectionV2s[0].id,
            fizz: 'jazz'
          };
          return test.peerConnectionManager.update([peerConnectionState]);
        }).then(() => {
          assert.equal(test.peerConnectionV2s[0].listenerCount('stateChanged'), 1);
        });
      });
    });
  });

  describe('"candidates" event', () => {
    it('is emitted whenever a PeerConnectionV2 created with #createAndOffer or #update emits it', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        var promise1 = new Promise(resolve => test.peerConnectionManager.once('candidates', resolve));
        test.peerConnectionV2s[0].emit('candidates', { foo: 'bar' });
        return promise1;
      }).then(result1 => {
        var promise2 = new Promise(resolve => test.peerConnectionManager.once('candidates', resolve));
        test.peerConnectionV2s[1].emit('candidates', { baz: 'qux' });
        return Promise.all([result1, promise2]);
      }).then(results => {
        assert.deepEqual(
          { foo: 'bar' },
          results[0]);
        assert.deepEqual(
          { baz: 'qux' },
          results[1]);
      });
    });
  });

  describe('"description" event', () => {
    it('is emitted whenever a PeerConnectionV2 created with #createAndOffer or #update emits it', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        var promise1 = new Promise(resolve => test.peerConnectionManager.once('description', resolve));
        test.peerConnectionV2s[0].emit('description', { foo: 'bar' });
        return promise1;
      }).then(result1 => {
        var promise2 = new Promise(resolve => test.peerConnectionManager.once('description', resolve));
        test.peerConnectionV2s[1].emit('description', { baz: 'qux' });
        return Promise.all([result1, promise2]);
      }).then(results => {
        assert.deepEqual(
          { foo: 'bar' },
          results[0]);
        assert.deepEqual(
          { baz: 'qux' },
          results[1]);
      });
    });
  });

  describe('"trackAdded" event', () => {
    it('is emitted whenever a PeerConnectionV2 created with #createAndOffer or #update emits it', () => {
      var test = makeTest();
      return test.peerConnectionManager.createAndOffer().then(() => {
        return test.peerConnectionManager.update([
          { id: '123' }
        ]);
      }).then(() => {
        var promise1 = new Promise(resolve => test.peerConnectionManager.once('trackAdded', resolve));
        test.peerConnectionV2s[0].emit('trackAdded', { foo: 'bar' });
        return promise1;
      }).then(result1 => {
        var promise2 = new Promise(resolve => test.peerConnectionManager.once('trackAdded', resolve));
        test.peerConnectionV2s[1].emit('trackAdded', { baz: 'qux' });
        return Promise.all([result1, promise2]);
      }).then(results => {
        assert.deepEqual(
          { foo: 'bar' },
          results[0]);
        assert.deepEqual(
          { baz: 'qux' },
          results[1]);
      });
    });
  });
});

function makeTest(options) {
  options = options || {};
  options.iceServers = options.iceServers || [];
  options.peerConnectionV2s = options.peerConnectionV2s || [];
  options.PeerConnectionV2 = options.PeerConnectionV2 || makePeerConnectionV2Constructor(options);
  options.peerConnectionManager = options.peerConnectionManager || new PeerConnectionManager(options);
  options.peerConnectionManager.setConfiguration({ iceServers: [] });
  return options;
}

function makePeerConnectionV2Constructor(testOptions) {
  return function PeerConnectionV2(id, options) {
    var peerConnectionV2 = new EventEmitter();

    peerConnectionV2.configuration = {
      iceServers: testOptions.iceServers
    };

    peerConnectionV2.id = id;

    peerConnectionV2.addMediaStream = sinon.spy();

    peerConnectionV2.close = sinon.spy();

    peerConnectionV2.offer = sinon.spy(() => Promise.resolve());

    peerConnectionV2.removeMediaStream = sinon.spy(() => {});

    peerConnectionV2.getState = () => ({
      id: id,
      fizz: 'buzz'
    });

    peerConnectionV2.setConfiguration = sinon.spy(configuration => {
      peerConnectionV2.configuration = configuration;
    });

    peerConnectionV2.update = sinon.spy(() => Promise.resolve());

    testOptions.peerConnectionV2s.push(peerConnectionV2);

    return peerConnectionV2;
  };
}

function makeId() {
  return Math.floor(Math.random() * 100 + 0.5);
}

function makeMediaStream(options) {
  options = options || {};
  options.id = options.id || makeId();
  options.audio = options.audio || 0;
  options.video = options.video || 0;

  if (typeof options.audio === 'number') {
    var audio = [];
    for (var i = 0; i < options.audio; i++) {
      var audioTrack = makeMediaStreamTrack({ kind: 'audio' });
      audio.push(audioTrack);
    }
    options.audio = audio;
  }

  if (typeof options.video === 'number') {
    var video = [];
    for (var i = 0; i < options.video; i++) {
      var videoTrack = makeMediaStreamTrack({ kind: 'video' });
      video.push(videoTrack);
    }
    options.video = video;
  }

  options.audio = options.audio.map(track => track instanceof MediaStreamTrack
    ? track : new MediaStreamTrack(track));

  options.video = options.video.map(track => track instanceof MediaStreamTrack
    ? track : new MediaStreamTrack(track));

  var mediaStream = new EventEmitter();

  mediaStream.addEventListener = mediaStream.addListener;

  mediaStream.removeEventListener = mediaStream.removeListener;

  mediaStream.getAudioTracks = () => options.audio;

  mediaStream.getVideoTracks = () => options.video;

  mediaStream.getTracks = () => options.audio.concat(options.video);

  return mediaStream;
}

function MediaStreamTrack(options) {
  options = options || {};
  this.id = options.id || makeId();
  this.kind = options.kind;
  EventEmitter.call(this);
}

inherits(MediaStreamTrack, EventEmitter);

MediaStreamTrack.prototype.addEventListener = MediaStreamTrack.prototype.addListener;

MediaStreamTrack.prototype.removeEventListener = MediaStreamTrack.prototype.removeListener;

function makeMediaStreamTrack(options) {
  return new MediaStreamTrack(options);
}
