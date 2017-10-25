'use strict';

const assert = require('assert');

const IceBox = require('../../../../../lib/signaling/v2/icebox');

describe('IceBox', () => {
  describe('constructor', () => {
    it('sets .ufrag to null', () => {
      const test = makeTest();
      assert.equal(null, test.iceBox.ufrag);
    });
  });

  describe('#setUfrag', () => {
    context('after ICE candidates with matching username fragment were added at', () => {
      context('an initial revision', () => {
        it('updates .ufrag', () => {
          const test = makeTest();
          const iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);

          test.iceBox.setUfrag('foo');
          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an array of the ICE candidates added, in order', () => {
          const test = makeTest();
          const iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);

          assert.deepEqual(
            [
              { candidate: 'candidate1' }
            ],
            test.iceBox.setUfrag('foo'));
        });
      });

      context('a new revision', () => {
        it('updates .ufrag', () => {
          const test = makeTest();
          const iceState1 = test.state().setCandidates('foo', 1);
          const iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState1);
          test.iceBox.update(iceState2);

          test.iceBox.setUfrag('foo');
          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an array of the ICE candidates added, in order and deduplicated', () => {
          const test = makeTest();
          const iceState1 = test.state().setCandidates('foo', 1);
          const iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState1);
          test.iceBox.update(iceState2);

          assert.deepEqual(
            [
              { candidate: 'candidate1' },
              { candidate: 'candidate2' }
            ],
            test.iceBox.setUfrag('foo'));
        });
      });

      context('the same revision', () => {
        it('updates .ufrag', () => {
          const test = makeTest();
          const iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);
          test.iceBox.update(iceState);

          test.iceBox.setUfrag('foo');
          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an array of the ICE candidates added, in order and deduplicated', () => {
          const test = makeTest();
          const iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);
          test.iceBox.update(iceState);

          assert.deepEqual(
            [
              { candidate: 'candidate1' }
            ],
            test.iceBox.setUfrag('foo'));
        });
      });

      context('an old revision', () => {
        it('updates .ufrag', () => {
          const test = makeTest();
          const iceState1 = test.state().setCandidates('foo', 1);
          const iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState2);
          test.iceBox.update(iceState1);

          test.iceBox.setUfrag('foo');
          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an array of the ICE candidates added, in order and deduplicated', () => {
          const test = makeTest();
          const iceState1 = test.state().setCandidates('foo', 1);
          const iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState2);
          test.iceBox.update(iceState1);

          assert.deepEqual(
            [
              { candidate: 'candidate1' },
              { candidate: 'candidate2' }
            ],
            test.iceBox.setUfrag('foo'));
        });
      });
    });

    context('before ICE candidates with matching username fragment have been added', () => {
      it('updates .ufrag', () => {
        const test = makeTest();
        test.iceBox.setUfrag('foo');
        assert.equal('foo', test.iceBox.ufrag);
      });

      it('returns an empty array', () => {
        const test = makeTest();
        assert.deepEqual(
          [],
          test.iceBox.setUfrag('foo'));
      });
    });
  });

  describe('#update, called with ICE candidates', () => {
    context('matching the current username fragment at', () => {
      context('an initial revision', () => {
        it('does not update .ufrag', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState = test.state().setCandidates('foo', 1);

          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an array of the initial ICE candidates added, in order', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState = test.state().setCandidates('foo', 1);

          assert.deepEqual(
            [
              { candidate: 'candidate1' }
            ],
            test.iceBox.update(iceState));
        });
      });

      context('a new revision', () => {
        it('does not update .ufrag', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState1 = test.state().setCandidates('foo', 1);
          const iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState1);

          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an array of the new ICE candidates added, in order', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState1 = test.state().setCandidates('foo', 1);
          const iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState1);

          assert.deepEqual(
            [
              { candidate: 'candidate2' }
            ],
            test.iceBox.update(iceState2));
        });
      });

      context('the same revision', () => {
        it('does not update .ufrag', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);

          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an empty array', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState = test.state().setCandidates('foo', 1);

          test.iceBox.update(iceState);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState));
        });
      });

      context('an old revision', () => {
        it('does not update .ufrag', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState1 = test.state().setCandidates('foo', 1);
          const iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState2);

          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an empty array', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState1 = test.state().setCandidates('foo', 1);
          const iceState2 = test.state().setCandidates('foo', 2);

          test.iceBox.update(iceState2);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState1));
        });
      });
    });

    context('called with ICE candidates not matching the current username fragment', () => {
      context('an initial revision', () => {
        it('does not update .ufrag', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState = test.state().setCandidates('bar', 1);

          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an empty array', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState = test.state().setCandidates('bar', 1);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState));
        });
      });

      context('a new revision', () => {
        it('does not update .ufrag', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState1 = test.state().setCandidates('bar', 1);
          const iceState2 = test.state().setCandidates('bar', 2);

          test.iceBox.update(iceState1);

          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an empty array', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState1 = test.state().setCandidates('bar', 1);
          const iceState2 = test.state().setCandidates('bar', 2);

          test.iceBox.update(iceState1);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState2));
        });
      });

      context('the same revision', () => {
        it('does not update .ufrag', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState = test.state().setCandidates('bar', 1);

          test.iceBox.update(iceState);

          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an empty array', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState = test.state().setCandidates('bar', 1);

          test.iceBox.update(iceState);

          assert.deepEqual(
            [],
            test.iceBox.update(iceState));
        });
      });

      context('an old revision', () => {
        it('does not update .ufrag', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState1 = test.state().setCandidates('bar', 1);
          const iceState2 = test.state().setCandidates('bar', 2);

          test.iceBox.update(iceState2);

          assert.equal('foo', test.iceBox.ufrag);
        });

        it('returns an empty array', () => {
          const test = makeTest({ ufrag: 'foo' });
          const iceState1 = test.state().setCandidates('bar', 1);
          const iceState2 = test.state().setCandidates('bar', 2);

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
  if (options.ufrag) {
    options.iceBox.setUfrag(options.ufrag);
  }
  options.state = function state() {
    return new IceStateBuilder();
  };
  return options;
}

function IceStateBuilder() {
  // Do nothing
}

IceStateBuilder.prototype.setCandidates = function setCandidates(ufrag, revision) {
  this.candidates = [];
  for (let i = 0; i < revision; i++) {
    this.candidates.push({ candidate: 'candidate' + (i + 1) });
  }
  this.revision = revision;
  this.ufrag = ufrag;
  return this;
};
