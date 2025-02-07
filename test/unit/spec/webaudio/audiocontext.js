'use strict';

const assert = require('assert');
const sinon = require('sinon');

const { AudioContextFactory } = require('../../../../lib/webaudio/audiocontext');

describe('AudioContextFactory', () => {
  let audioContext;
  let AudioContext;
  let audioContextFactory;

  beforeEach(() => {
    audioContext = {
      close: sinon.spy()
    };
    AudioContext = sinon.spy(() => audioContext);
    audioContextFactory = new AudioContextFactory({ AudioContext });
  });

  describe('#getOrCreate(holder)', () => {
    context('called before an AudioContext was ever constructed', () => {
      context('with a new holder', () => {
        let holder;
        let result;

        beforeEach(() => {
          holder = {};
          result = audioContextFactory.getOrCreate(holder);
        });

        it('returns a new AudioContext', () => {
          assert.equal(result, audioContext);
          sinon.assert.calledOnce(AudioContext);
        });
      });
    });

    context('called after an AudioContext was constructed', () => {
      let holder1;

      beforeEach(() => {
        holder1 = {};
        audioContextFactory.getOrCreate(holder1);
        AudioContext.reset();
      });

      context('with an existing holder', () => {
        let result;

        beforeEach(() => {
          result = audioContextFactory.getOrCreate(holder1);
        });

        it('returns the existing AudioContext', () => {
          assert.equal(result, audioContext);
          sinon.assert.notCalled(AudioContext);
        });
      });

      context('with a new holder', () => {
        let holder2;
        let result;

        beforeEach(() => {
          holder2 = {};
          result = audioContextFactory.getOrCreate(holder2);
        });

        it('returns the existing AudioContext', () => {
          assert.equal(result, audioContext);
          sinon.assert.notCalled(AudioContext);
        });
      });
    });

    context('called after an AudioContext was closed', () => {
      let holder1;

      beforeEach(() => {
        holder1 = {};
        audioContextFactory.getOrCreate(holder1);
        audioContextFactory.release(holder1);
        AudioContext.reset();
      });

      context('with a previous holder', () => {
        let result;

        beforeEach(() => {
          result = audioContextFactory.getOrCreate(holder1);
        });

        it('returns a new AudioContext', () => {
          assert.equal(result, audioContext);
          sinon.assert.calledOnce(AudioContext);
        });
      });

      context('with a new holder', () => {
        let holder2;
        let result;

        beforeEach(() => {
          holder2 = {};
          result = audioContextFactory.getOrCreate(holder2);
        });

        it('returns a new AudioContext', () => {
          assert.equal(result, audioContext);
          sinon.assert.calledOnce(AudioContext);
        });
      });
    });
  });

  describe('#release(holder)', () => {
    context('called before an AudioContext was ever constructed', () => {
      let holder;
      let result;

      beforeEach(() => {
        holder = {};
        audioContextFactory.release(holder);
      });

      it('returns undefined', () => {
        assert.equal(result, undefined);
      });
    });

    context('called after an AudioContext was constructed', () => {
      let holder1;
      let holder2;

      beforeEach(() => {
        holder1 = {};
        holder2 = {};
        audioContextFactory.getOrCreate(holder1);
        audioContextFactory.getOrCreate(holder2);
      });

      context('with an existing holder', () => {
        let result1;

        beforeEach(() => {
          result1 = audioContextFactory.release(holder1);
        });

        it('returns undefined', () => {
          assert.equal(result1, undefined);
        });

        context('it returns undefined and, if the holder was the last holder,', () => {
          let result2;

          beforeEach(() => {
            result2 = audioContextFactory.release(holder2);
            assert.equal(result2, undefined);
          });

          it('closes the AudioContext', () => {
            sinon.assert.calledOnce(audioContext.close);
          });
        });

        context('it returns undefined and, if the holder was not the last holder,', () => {
          it('does not close the AudioContext', () => {
            sinon.assert.notCalled(audioContext.close);
          });
        });
      });

      context('with a non-holder', () => {
        let holder3;
        let result3;

        beforeEach(() => {
          result3 = audioContextFactory.release(holder3);
        });

        it('returns undefined and does not close the AudioContext', () => {
          assert.equal(result3, undefined);
          sinon.assert.notCalled(audioContext.close);
        });
      });
    });
  });

  describe('#setAudioContext', () => {
    it('sets and uses the custom audio context', () => {
      const mockAudioContext = { close: sinon.spy() };
      const factory = new AudioContextFactory();
      factory.setAudioContext(mockAudioContext);
      let holder = {};
      const result = factory.getOrCreate(holder);
      assert.equal(result, mockAudioContext);
      factory.release(holder);
      sinon.assert.calledOnce(mockAudioContext.close);
    });

    it('throws an error if the audio context is disabled', () => {
      const factory = new AudioContextFactory();
      factory.disable();
      assert.throws(() => factory.setAudioContext({}), Error);
    });
  });

  describe('#disable', () => {
    it('disables the audio context', () => {
      const factory = new AudioContextFactory();
      assert.equal(factory.isEnabled(), true);
      factory.disable();
      assert.equal(factory.isEnabled(), false);
    });
  });
});
