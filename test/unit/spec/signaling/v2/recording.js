'use strict';

const assert = require('assert');

const RecordingV2 = require('../../../../../lib/signaling/v2/recording');

const { combinationContext } = require('../../../../lib/util');

describe('RecordingV2', () => {
  // RecordingV2
  // -----------

  describe('constructor', () => {
    it('sets .isEnabled to null', () => {
      assert.equal(new RecordingV2().isEnabled, null);
    });
  });

  describe('#update, when called with a recordingState at', () => {
    combinationContext([
      [
        [2, 1, 0],
        x => ({
          2: 'a newer revision',
          1: 'the current revision',
          0: 'an older revision'
        })[x] + ' and .is_recording set to'
      ],
      [
        [false, true],
        x => x + ', when .is_recording is'
      ],
      [
        [null, false, true],
        String
      ]
    ], ([revision, enabled, isEnabled]) => {
      testUpdate(revision, enabled, isEnabled);
    });
  });

  // RecordingSignaling
  // ------------------

  describe('#disable, called when the RecordingV2\'s .isEnabled property is', () => {
    combinationContext([
      [
        [null, false, true],
        String
      ]
    ], ([isEnabled]) => {
      testEnableOrDisable('disable', null, isEnabled);
    });
  });

  describe('#enable, called', () => {
    combinationContext([
      [
        [false, true, null],
        x => ({
          false: 'with false',
          true: 'with true',
          null: 'without arguments'
        })[x] + ' when the RecordingV2\'s .isEnabled property is'
      ],
      [
        [null, true, false],
        String
      ]
    ], ([enable, isEnabled]) => {
      testEnableOrDisable('enable', enable, isEnabled);
    });
  });
});

function testEnableOrDisable(method, argument, isEnabled) {
  const expectedIsEnabled = typeof argument === 'boolean'
    ? argument
    : method === 'enable';

  let runMethod;
  let recording;

  beforeEach(() => {
    recording = new RecordingV2();

    if (typeof isEnabled === 'boolean') {
      if (isEnabled) {
        recording.enable();
      } else {
        recording.disable();
      }
    }

    runMethod = function runMethod() {
      return typeof argument === 'boolean'
        ? recording[method](argument)
        : recording[method]();
    };
  });

  it('returns the RecordingV2', () => {
    assert.equal(runMethod(), recording);
  });

  if (expectedIsEnabled !== isEnabled) {
    it('sets .isEnabled to ' + expectedIsEnabled, () => {
      assert.equal(runMethod().isEnabled, expectedIsEnabled);
    });

    it('emits an "updated" event with .isEnabled set to ' + expectedIsEnabled, () => {
      let actualIsEnabled;
      recording.once('updated', () => { actualIsEnabled = recording.isEnabled; });
      runMethod();
      assert.equal(actualIsEnabled, expectedIsEnabled);
    });

  } else {
    it('.isEnabled remains ' + expectedIsEnabled, () => {
      assert.equal(runMethod().isEnabled, expectedIsEnabled);
    });

    it('does not emit an "updated" event', () => {
      let updated;
      recording.once('updated', () => { updated = true; });
      runMethod();
      assert(!updated);
    });
  }
}

function testUpdate(revision, enabled, isEnabled) {
  const recordingState = {
    // eslint-disable-next-line camelcase
    is_recording: enabled,
    revision: revision
  };

  let recording;

  beforeEach(() => {
    recording = new RecordingV2();
    if (typeof isEnabled === 'boolean') {
      if (isEnabled) {
        recording.enable();
      } else {
        recording.disable();
      }
    }
  });

  it('returns the RecordingV2', () => {
    assert.equal(recording.update(recordingState), recording);
  });

  if (revision >= 1) {
    it('updates .isEnabled', () => {
      assert.equal(recording.update(recordingState).isEnabled, enabled);
    });

    it('updates the ._revision', () => {
      assert.equal(recording.update(recordingState)._revision, revision);
    });

    if (enabled === isEnabled) {
      it('does not emit an "updated" event', () => {
        let updated;
        recording.once('updated', () => { updated = true; });
        recording.update(recordingState);
        assert(!updated);
      });
    } else {
      it('emits an "updated" event with .isEnabled set to ' + enabled, () => {
        let actualIsEnabled;
        recording.once('updated', () => { actualIsEnabled = recording.isEnabled; });
        recording.update(recordingState);
        assert.equal(actualIsEnabled, enabled);
      });
    }
  } else {
    it('does not update .isEnabled', () => {
      assert.equal(recording.update(recordingState).isEnabled, isEnabled);
    });

    if (typeof isEnabled === 'boolean') {
      it('does not update the ._revision', () => {
        assert.equal(recording.update(recordingState)._revision, 1);
      });
    }

    it('does not emit an "updated" event', () => {
      let updated;
      recording.once('updated', () => { updated = true; });
      recording.update(recordingState);
      assert(!updated);
    });
  }
}
