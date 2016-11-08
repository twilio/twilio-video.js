'use strict';

var assert = require('assert');
var RecordingV2 = require('../../../../../lib/signaling/v2/recording');
var sinon = require('sinon');
var util = require('../../../../../lib/util');

describe('RecordingV2', () => {
  // RecordingV2
  // -----------

  describe('constructor', () => {
    it('sets .isEnabled to null', () => {
      assert.equal(new RecordingV2().isEnabled, null);
    });
  });

  describe('#update, when called with a recordingState at', () => {
    [
      ['a newer revision', 2],
      ['the current revision', 1],
      ['an older revision', 0]
    ].forEach(pair => {
      const revision = pair[1];
      const revisionDescription = pair[0];

      context(revisionDescription + ' and .enabled set to', () => {
        [
          false,
          true
        ].forEach(enabled => {
          context(enabled + ', when .isEnabled is', () => {
            [
              null,
              false,
              true
            ].forEach(isEnabled => {
              context(isEnabled, () => {
                testUpdate(revision, enabled, isEnabled);
              });
            });
          });
        });
      });
    });
  });

  // RecordingSignaling
  // ------------------

  describe('#disable, called when the RecordingV2\'s .isEnabled property is', () => {
    [
      null,
      false,
      true
    ].forEach(isEnabled => {
      context(isEnabled, () => {
        testEnableOrDisable('disable', null, isEnabled);
      });
    });
  });

  describe('#enable, called', () => {
    [
      ['with false', false],
      ['with true', true],
      ['without arguments', null]
    ].forEach(pair => {
      const enableDescription = pair[0];
      const enable = pair[1];

      context(enableDescription + ' when the RecordingV2\'s .isEnabled property is', () => {
        [
          null,
          false,
          true
        ].forEach(isEnabled => {
          context(isEnabled, () => {
            testEnableOrDisable('enable', enable, isEnabled);
          });
        });
      });
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
