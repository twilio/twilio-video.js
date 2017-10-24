'use strict';

const assert = require('assert');
const sinon = require('sinon');

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
        })[x] + ' and .enabled set to'
      ],
      [
        [false, true],
        x => x + ', when .isEnabled is'
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
  var expectedIsEnabled = typeof argument === 'boolean'
    ? argument
    : method === 'enable';

  var runMethod;
  var recording;

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
      var actualIsEnabled;
      recording.once('updated', () => actualIsEnabled = recording.isEnabled);
      runMethod();
      assert.equal(actualIsEnabled, expectedIsEnabled);
    });

  } else {
    it('.isEnabled remains ' + expectedIsEnabled, () => {
      assert.equal(runMethod().isEnabled, expectedIsEnabled);
    });

    it('does not emit an "updated" event', () => {
      var updated = false;
      recording.once('updated', () => updated = true);
      runMethod();
      assert(!updated);
    });
  }
}

function testUpdate(revision, enabled, isEnabled) {
  var recording;
  var recordingState = {
    enabled: enabled,
    revision: revision
  };

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
        var updated = false;
        recording.once('updated', () => updated = true);
        recording.update(recordingState);
        assert(!updated);
      });
    } else {
      it('emits an "updated" event with .isEnabled set to ' + enabled, () => {
        var actualIsEnabled;
        recording.once('updated', () => actualIsEnabled = recording.isEnabled);
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
      var updated = false;
      recording.once('updated', () => updated = true);
      recording.update(recordingState);
      assert(!updated);
    });
  }
}
