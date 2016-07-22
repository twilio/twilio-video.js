'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var PeerConnectionManager = require('../../../../../lib/signaling/v2/peerconnectionmanager');
var sinon = require('sinon');

describe('PeerConnectionManager', function() {
  describe('constructor', function() {
    it('returns an instance of PeerConnectionManager', function() {
      assert(new PeerConnectionManager() instanceof PeerConnectionManager);
    });
  });

  describe('#addStream', function() {
    it('calls addStream on each PeerConnection', function() {
      var pcs = [];
      var pcm = new PeerConnectionManager({
        initialOffers: 3,
        RTCPeerConnection: function(config) {
          var pc = new RTCPeerConnection(config);
          sinon.spy(pc, 'addStream');
          pcs.push(pc);
          return pc;
        }
      });

      return pcm.setConfiguration({}).then(function() {
        assert.equal(3, pcs.length);
        var mediaStream = 'dummy-mediastream';
        pcm.addStream(mediaStream);
        assert(pcs.every(function(pc) {
          return pc.addStream.calledWith(mediaStream);
        }));
      });
    });
  });

  describe('#close', function() {
    it('calls close on each PeerConnection', function() {
      var pcs = [];
      var pcm = new PeerConnectionManager({
        initialOffers: 3,
        RTCPeerConnection: function(config) {
          var pc = new RTCPeerConnection(config);
          sinon.spy(pc, 'close');
          pcs.push(pc);
          return pc;
        }
      });

      return pcm.setConfiguration({}).then(function() {
        assert.equal(3, pcs.length);
        pcm.close();
        assert(pcs.every(function(pc) {
          return pc.close.called;
        }));
      });
    });
  });

  describe('#getState', function() {
    it('returns the subset of PeerConnections that changed', function() {
      var pcs = [];
      var pcm = new PeerConnectionManager({
        RTCPeerConnection: function(config) {
          var pc = new RTCPeerConnection(config);
          pcs.push(pc);
          return pc;
        },
        RTCSessionDescription: function(description) {
          return description;
        }
      });

      return pcm.update(new RoomStateBuilder()
        .createOffer(1)
        .offer(2))
      .then(function() {
        // Until we call setConfiguration, we should not have constructed any
        // PeerConnections; hence we expect zero PeerConnection Messages.
        assert.equal(null, pcm.getState());
        return pcm.setConfiguration({});
      }).then(function() {
        // Once we've called setConfiguration, we should have constructed the
        // two PeerConnections, and we expect two PeerConnection Messages.
        assert.deepEqual(new RoomStateBuilder()
            .offer(1)
            .answer(2)
            .peer_connections,
          pcm.getState().peer_connections);
        // Now, simulate receiving an answer.
        return pcm.update(new RoomStateBuilder()
            .answer(1)
            .offer(3));
      }).then(function() {
        // We expect one new PeerConnection Message now (since both of the first
        // two PeerConnections are stable).
        assert.deepEqual(new RoomStateBuilder()
            .answer(3)
            .peer_connections,
          pcm.getState().peer_connections);
      });
    });
  });

  describe('#removeStream', function() {
    it('calls removeStream on each PeerConnection', function() {
      var pcs = [];
      var pcm = new PeerConnectionManager({
        initialOffers: 3,
        RTCPeerConnection: function(config) {
          var pc = new RTCPeerConnection(config);
          sinon.spy(pc, 'removeStream');
          pcs.push(pc);
          return pc;
        }
      });

      return pcm.setConfiguration({}).then(function() {
        assert.equal(3, pcs.length);
        var mediaStream = 'dummy-mediastream';
        pcm.addStream(mediaStream);
        pcm.removeStream(mediaStream);
        assert(pcs.every(function(pc) {
          return pc.removeStream.calledWith(mediaStream);
        }));
      });
    });
  });

  describe('#renegotiate', function() {
  });

  describe('#setConfiguration', function() {
    it('sets RTCConfiguration for any newly-constructed PeerConnections', function() {
      var config1 = {
        iceServers: [ { url: 'foo' } ],
        iceTransportPolicy: 'bar'
      };

      var config2 = {
        iceServers: [ { urls: 'baz' } ]
      };

      var pc;
      var pcm = new PeerConnectionManager({
        initialOffers: 0,
        RTCPeerConnection: function(config) {
          return pc = new RTCPeerConnection(config);
        }
      });

      // Check that the first PeerConnection uses the given configuration.
      return pcm.setConfiguration(config1).then(function() {
        return pcm.update(new RoomStateBuilder().createOffer(1));
      }).then(function() {
        assert.deepEqual({
          iceServers: [ { urls: [ 'foo' ] } ],
          iceTransportPolicy: 'bar',
          iceTransports: 'bar'
        }, pc.getConfiguration());
        // Then, check that the second PeerConnection uses the given configuration.
        return pcm.setConfiguration(config2);
      }).then(function() {
        return pcm.update(new RoomStateBuilder().createOffer(2));
      }).then(function() {
        assert.deepEqual({
          iceServers: [ { urls: 'baz' } ],
          iceTransportPolicy: 'bar',
          iceTransports: 'bar'
        }, pc.getConfiguration());
      });
    });

    context('when called the first time, before #update', function() {
      it('constructs PeerConnections and creates offers, as specified by initialOffers', function() {
        var pcs = [];
        var pcm = new PeerConnectionManager({
          initialOffers: 5,
          RTCPeerConnection: function(config) {
            var pc = new RTCPeerConnection(config);
            sinon.spy(pc, 'createOffer');
            sinon.spy(pc, 'setLocalDescription');
            pcs.push(pc);
            return pc;
          }
        });

        return pcm.setConfiguration({}).then(function() {
          assert.equal(5, pcs.length);
          assert(pcs.every(function(pc) {
            return pc.createOffer.called && pc.setLocalDescription.called;
          }));
        });
      });
    });

    context('when called the first time, after #update', function() {
      it('does not construct PeerConnections or create offers, ignoring initialOffers', function() {
        var pcs = [];
        var pcm = new PeerConnectionManager({
          RTCPeerConnection: function(config) {
            var pc = new RTCPeerConnection(config);
            pcs.push(pc);
            return pc;
          }
        });

        return pcm.update(new RoomStateBuilder()).then(function() {
          return pcm.setConfiguration({});
        }).then(function() {
          assert.equal(0, pcs.length);
        });
      });
    });
  });

  describe('#update', function() {
    context('when called with PeerConnection Messages that include a "create-offer"', function() {
      context('after #setConfiguration', function() {
        it('immediately constructs a PeerConnection before calling createOffer and setLocalDescription', function() {
          var pc;
          var pcm = new PeerConnectionManager({
            initialOffers: 0,
            RTCPeerConnection: function(config) {
              pc = new RTCPeerConnection(config);
              sinon.spy(pc, 'createOffer');
              sinon.spy(pc, 'setLocalDescription');
              return pc;
            }
          });

          return pcm.setConfiguration({}).then(function() {
            return pcm.update(new RoomStateBuilder().createOffer());
          }).then(function() {
            assert(pc);
            assert(pc.createOffer.called);
            assert(pc.setLocalDescription.calledWith({ type: 'offer', sdp: 'dummy-offer' }));
          });
        });
      });

      context('before #setConfiguration', function() {
        it('waits to construct a PeerConnection before calling createOffer and setLocalDescription', function() {
          var pc;
          var pcm = new PeerConnectionManager({
            RTCPeerConnection: function(config) {
              pc = new RTCPeerConnection(config);
              sinon.spy(pc, 'createOffer');
              sinon.spy(pc, 'setLocalDescription');
              return pc;
            }
          });

          return pcm.update(new RoomStateBuilder().createOffer()).then(function() {
            assert(!pc);
            return pcm.setConfiguration({});
          }).then(function() {
            assert(pc);
            assert(pc.createOffer.called);
            assert(pc.setLocalDescription.calledWith({ type: 'offer', sdp: 'dummy-offer' }));
          });
        });
      });
    });

    context('when called with PeerConnection Messages that include an "offer"', function() {
      context('after #setConfiguration', function() {
        it('immediately constructs a PeerConnection before calling setRemoteDescription, createAnswer, and setLocalDescription', function() {
          var pc;
          var pcm = new PeerConnectionManager({
            initialOffers: 0,
            RTCPeerConnection: function(config) {
              pc = new RTCPeerConnection(config);
              sinon.spy(pc, 'setRemoteDescription');
              sinon.spy(pc, 'createAnswer');
              sinon.spy(pc, 'setLocalDescription');
              return pc;
            },
            RTCSessionDescription: function(description) {
              return description;
            }
          });

          return pcm.setConfiguration({}).then(function() {
            return pcm.update(new RoomStateBuilder().offer());
          }).then(function() {
            assert(pc);
            assert(pc.setRemoteDescription.calledWith({ type: 'offer', sdp: 'dummy-offer' }));
            assert(pc.createAnswer.called);
            assert(pc.setLocalDescription.calledWith({ type: 'answer', sdp: 'dummy-answer' }));
          });
        });
      });

      context('before #setConfiguration', function() {
        it('waits to construct a PeerConnection before calling setRemoteDescription, createAnswer, and setLocalDescription', function() {
          var pc;
          var pcm = new PeerConnectionManager({
            RTCPeerConnection: function(config) {
              pc = new RTCPeerConnection(config);
              sinon.spy(pc, 'setRemoteDescription');
              sinon.spy(pc, 'createAnswer');
              sinon.spy(pc, 'setLocalDescription');
              return pc;
            },
            RTCSessionDescription: function(description) {
              return description;
            }
          });

          return pcm.update(new RoomStateBuilder().offer()).then(function() {
            assert(!pc);
            return pcm.setConfiguration({});
          }).then(function() {
            assert(pc);
            assert(pc.setRemoteDescription.calledWith({ type: 'offer', sdp: 'dummy-offer' }));
            assert(pc.createAnswer.called);
            assert(pc.setLocalDescription.calledWith({ type: 'answer', sdp: 'dummy-answer' }));
          });
        });
      });
    });

    context('when called with PeerConnection Messages that include an "answer"', function() {
      it('calls setRemoteDescription on the PeerConnection', function() {
        var pc;
        var pcm = new PeerConnectionManager({
          initialOffers: 0,
          RTCPeerConnection: function(config) {
            pc = new RTCPeerConnection(config);
            sinon.spy(pc, 'setRemoteDescription');
            return pc;
          },
          RTCSessionDescription: function(description) {
            return description;
          }
        });

        return pcm.setConfiguration({}).then(function() {
          return pcm.update(new RoomStateBuilder().createOffer());
        }).then(function() {
          return pcm.update(new RoomStateBuilder().answer());
        }).then(function() {
          assert(pc.setRemoteDescription.calledWith({ type: 'answer', sdp: 'dummy-answer' }));
        });
      });
    });

    context('when called with PeerConnection Messages that include a "close"', function() {
      it('closes the PeerConnection', function() {
        var pcs = [];
        var pcm = new PeerConnectionManager({
          initialOffers: 0,
          RTCPeerConnection: function(config) {
            var pc = new RTCPeerConnection(config);
            sinon.spy(pc, 'close');
            pcs.push(pc);
            return pc;
          },
          RTCSessionDescription: function(description) {
            return description;
          }
        });

        // NOTE(mroberts): Test PeerConnections setup in "both" directions.
        return pcm.setConfiguration({}).then(function() {
          return pcm.update(new RoomStateBuilder()
            .createOffer(1)
            .offer(2))
        }).then(function() {
          return pcm.update(new RoomStateBuilder().answer(1));
        }).then(function() {
          assert.equal(2, pcs.length);
          return pcm.update(new RoomStateBuilder().close(1).close(2));
        }).then(function() {
          assert(pcs[0].close.called);
          assert(pcs[1].close.called);
        });
      });
    });
  });
});

function RoomStateBuilder() {
  this.peer_connections = [];
}

RoomStateBuilder.prototype.answer = function answer(id, sdp) {
  id = id == null ? 1 : id;
  this.peer_connections.push({
    id: id,
    description: {
      type: 'answer',
      sdp: sdp || 'dummy-answer'
    }
  });
  return this;
};

RoomStateBuilder.prototype.close = function close(id) {
  id = id == null ? 1 : id;
  this.peer_connections.push({
    id: id,
    description: {
      type: 'close'
    }
  });
  return this;
};

RoomStateBuilder.prototype.createOffer = function createOffer(id) {
  id = id == null ? 1 : id;
  this.peer_connections.push({
    id: id,
    description: {
      type: 'create-offer'
    }
  });
  return this;
};

RoomStateBuilder.prototype.offer = function offer(id, sdp) {
  id = id == null ? 1 : id;
  this.peer_connections.push({
    id: id,
    description: {
      type: 'offer',
      sdp: sdp || 'dummy-offer'
    }
  });
  return this;
};

function RTCPeerConnection(configuration) {
  EventEmitter.call(this);
  this._configuration = configuration;
  this._localStreams = [];
  this.iceGatheringState = 'complete';
  this.localDescription = null;
  this.remoteDescription = null;
  this.signalingState = 'stable';
}

inherits(RTCPeerConnection, EventEmitter);

RTCPeerConnection.prototype.addEventListener = RTCPeerConnection.prototype.addListener;

RTCPeerConnection.prototype.addStream = function addStream(mediaStream) {
  this._localStreams.push(mediaStream);
};

RTCPeerConnection.prototype.close = function close() {
  this.signalingState = 'closed';
};

RTCPeerConnection.prototype.createAnswer = function createAnswer(onSuccess) {
  onSuccess({
    type: 'answer',
    sdp: 'dummy-answer'
  });
};

RTCPeerConnection.prototype.createOffer = function createOffer(onSuccess) {
  onSuccess({
    type: 'offer',
    sdp: 'dummy-offer'
  });
};

RTCPeerConnection.prototype.getConfiguration = function getConfiguration() {
  return this._configuration;
};

RTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
  return this._localStreams;
};

RTCPeerConnection.prototype.getRemoteStreams = function getRemoteStreams() {
  return [];
};

RTCPeerConnection.prototype.setLocalDescription = function setLocalDescription(description, onSuccess) {
  this.localDescription = description;
  this.signalingState = this.signalingState === 'have-remote-offer' ? 'stable' : 'have-local-offer';
  onSuccess();
};

RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription(description, onSuccess) {
  this.remoteDescription = description;
  this.signalingState = this.signalingState === 'have-local-offer' ? 'stable' : 'have-remote-offer';
  onSuccess();
};

RTCPeerConnection.prototype.removeEventListener = RTCPeerConnection.prototype.removeListener;

RTCPeerConnection.prototype.removeStream = function removeStream(mediaStream) {
  this._localStreams.splice(this._localStreams.indexOf(mediaStream), 1);
};
