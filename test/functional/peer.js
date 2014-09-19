var Peer = require('../../src/peer');
var PeerSession = require('../../src/session/peersession');
var PSTNSession = require('../../src/session/pstnsession');
var SIPSession = require('../../src/session/sipsession');
var TwiMLSession = require('../../src/session/twimlsession');

var server = require('../server');

describe('Peer', function() {

  it('constructor accepts callback to be called once registered', function(done) {
    var peer = new Peer('ws://127.0.0.1:8080', 'mark', done);
  });

  it('emits the "registered" event once registered', function(done) {
    var peer = new Peer('ws://127.0.0.1:8080', 'mark');
    peer.on('registered', done);
  });

  it('connects to a Peer session', function(done) {
    var peer1 = new Peer('ws://127.0.0.1:8080', 'peer1', function(error) {
      if (error) {
        return done(error);
      }
      var peer2 = new Peer('ws://127.0.0.1:8080', 'peer2', function(error) {
        if (error) {
          return done(error);
        }
        peer2.connect('peer1@cheerful-owl.twil.io', function(error, session) {
          if (error) {
            return done(error);
          }
          if (!(session instanceof PeerSession)) {
            return done(new Error('Session is not an instance of PeerSession'));
          }
          done();
        });
      });
    });
  });

  it('connects to a TwiML session', function(done) {
    var peer = new Peer('ws://127.0.0.1:8080', 'mark', function(error) {
      if (error) {
        return done(error);
      }
      peer.connect('twiml1.cheerful-owl.twil.io', function(error, session) {
        if (error) {
          return done(error);
        }
        if (!(session instanceof TwiMLSession)) {
          return done(new Error('Session is not an instance of TwiMLSession'));
        }
        done();
      });
    });
  });

});
