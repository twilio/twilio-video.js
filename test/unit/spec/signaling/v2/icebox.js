'use strict';

var assert = require('assert');
var IceBox = require('../../../../../lib/signaling/v2/icebox');

describe('IceBox', () => {
  describe('constructor', () => {
    it('sets .usernameFragment to null', () => {
      var test = makeTest();
      assert.equal(null, test.iceBox.usernameFragment);
    });
  });

  describe('#setUsernameFragment', () => {
    context('after ICE candidates with matching username fragment were added at', () => {
      context('an initial revision', () => {
        it('updates .usernameFragment', () => {
          var test = makeTest();
          var iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);

          test.iceBox.setUsernameFragment('foo');
          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an array of the ICE candidates added, in order', () => {
          var test = makeTest();
          var iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);

          assert.deepEqual(
            [
              { candidate: 'candidate1' }
            ],
            test.iceBox.setUsernameFragment('foo'));
        });
      });

      context('a new revision', () => {
        it('updates .usernameFragment', () => {
          var test = makeTest();
          var iceState1 = test.state().setCandidates('foo', 1);
          var iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState1);
          test.iceBox.update(iceState2);

          test.iceBox.setUsernameFragment('foo');
          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an array of the ICE candidates added, in order and deduplicated', () => {
          var test = makeTest();
          var iceState1 = test.state().setCandidates('foo', 1);
          var iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState1);
          test.iceBox.update(iceState2);

          assert.deepEqual(
            [
              { candidate: 'candidate1' },
              { candidate: 'candidate2' }
            ],
            test.iceBox.setUsernameFragment('foo'));
        });
      });

      context('the same revision', () => {
        it('updates .usernameFragment', () => {
          var test = makeTest();
          var iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);
          test.iceBox.update(iceState);

          test.iceBox.setUsernameFragment('foo');
          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an array of the ICE candidates added, in order and deduplicated', () => {
          var test = makeTest();
          var iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);
          test.iceBox.update(iceState);

          assert.deepEqual(
            [
              { candidate: 'candidate1' }
            ],
            test.iceBox.setUsernameFragment('foo'));
        });
      });

      context('an old revision', () => {
        it('updates .usernameFragment', () => {
          var test = makeTest();
          var iceState1 = test.state().setCandidates('foo', 1);
          var iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState2);
          test.iceBox.update(iceState1);

          test.iceBox.setUsernameFragment('foo');
          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an array of the ICE candidates added, in order and deduplicated', () => {
          var test = makeTest();
          var iceState1 = test.state().setCandidates('foo', 1);
          var iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState2);
          test.iceBox.update(iceState1);

          assert.deepEqual(
            [
              { candidate: 'candidate1' },
              { candidate: 'candidate2' }
            ],
            test.iceBox.setUsernameFragment('foo'));
        });
      });
    });

    context('before ICE candidates with matching username fragment have been added', () => {
      it('updates .usernameFragment', () => {
        var test = makeTest();
        test.iceBox.setUsernameFragment('foo');
        assert.equal('foo', test.iceBox.usernameFragment);
      });

      it('returns an empty array', () => {
        var test = makeTest();
        assert.deepEqual(
          [],
          test.iceBox.setUsernameFragment('foo'));
      });
    });
  });

  describe('#update, called with ICE candidates', () => {
    context('matching the current username fragment at', () => {
      context('an initial revision', () => {
        it('does not update .usernameFragment', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState = test.state().setCandidates('foo', 1);

          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an array of the initial ICE candidates added, in order', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState = test.state().setCandidates('foo', 1);

          assert.deepEqual(
            [
              { candidate: 'candidate1' }
            ],
            test.iceBox.update(iceState));
        });
      });

      context('a new revision', () => {
        it('does not update .usernameFragment', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState1 = test.state().setCandidates('foo', 1);
          var iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState1);

          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an array of the new ICE candidates added, in order', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState1 = test.state().setCandidates('foo', 1);
          var iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState1);

          assert.deepEqual(
            [
              { candidate: 'candidate2' }
            ],
            test.iceBox.update(iceState2));
        });
      });

      context('the same revision', () => {
        it('does not update .usernameFragment', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);

          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an empty array', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState));
        });
      });

      context('an old revision', () => {
        it('does not update .usernameFragment', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState1 = test.state().setCandidates('foo', 1);
          var iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState2);

          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an empty array', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState1 = test.state().setCandidates('foo', 1);
          var iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState2);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState1));
        });
      });
    });

    context('called with ICE candidates not matching the current username fragment', () => {
      context('an initial revision', () => {
        it('does not update .usernameFragment', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState = test.state().setCandidates('bar', 1);

          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an empty array', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState = test.state().setCandidates('bar', 1);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState));
        });
      });

      context('a new revision', () => {
        it('does not update .usernameFragment', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState1 = test.state().setCandidates('bar', 1);
          var iceState2 = test.state().setCandidates('bar', 2);

          test.iceBox.update(iceState1);

          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an empty array', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState1 = test.state().setCandidates('bar', 1);
          var iceState2 = test.state().setCandidates('bar', 2);

          test.iceBox.update(iceState1);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState2));
        });
      });

      context('the same revision', () => {
        it('does not update .usernameFragment', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState = test.state().setCandidates('bar', 1);

          test.iceBox.update(iceState);

          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an empty array', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState = test.state().setCandidates('bar', 1);

          test.iceBox.update(iceState);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState));
        });
      });

      context('an old revision', () => {
        it('does not update .usernameFragment', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState1 = test.state().setCandidates('bar', 1);
          var iceState2 = test.state().setCandidates('bar', 2);

          test.iceBox.update(iceState2);

          assert.equal('foo', test.iceBox.usernameFragment);
        });

        it('returns an empty array', () => {
          var test = makeTest({ usernameFragment: 'foo' });
          var iceState1 = test.state().setCandidates('bar', 1);
          var iceState2 = test.state().setCandidates('bar', 2);

          test.iceBox.update(iceState2);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState1));
        });
      });
    });
  });
});

function makeTest(options) {
  options = options || {};
  options.iceBox = options.iceBox || new IceBox();
  if (options.usernameFragment) {
    options.iceBox.setUsernameFragment(options.usernameFragment);
  }
  options.state = function state() {
    return new IceStateBuilder();
  };
  return options;
}

function IceStateBuilder() {
  // Do nothing
}

IceStateBuilder.prototype.setCandidates = function setCandidates(usernameFragment, revision) {
  this.candidates = [];
  for (var i = 0; i < revision; i++) {
    this.candidates.push({ candidate: 'candidate' + (i + 1) });
  }
  this.revision = revision;
  this.ufrag = usernameFragment;
  return this;
};
