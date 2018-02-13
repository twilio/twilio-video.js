'use strict';

const assert = require('assert');

const LocalDataTrack = require('../../../../../../lib/media/track/localdatatrack');
const LocalDataTrackES5 = require('../../../../../../lib/media/track/es5/localdatatrack');

describe('LocalDataTrack (ES5)', () => {
  describe('constructor', () => {
    it('can be called without new', () => {
      // eslint-disable-next-line new-cap
      assert(LocalDataTrackES5());
    });

    it('can be called without new', () => {
      assert(new LocalDataTrackES5());
    });

    it('returns an instanceof LocalDataTrack', () => {
      assert(new LocalDataTrackES5() instanceof LocalDataTrack);
    });

    it('returns an instanceof LocalDataTrack (ES5)', () => {
      assert(new LocalDataTrackES5() instanceof LocalDataTrackES5);
    });
  });
});
