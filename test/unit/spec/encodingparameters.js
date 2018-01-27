'use strict';

const assert = require('assert');

const EncodingParametersImpl = require('../../../lib/encodingparameters');

const { combinationContext } = require('../../lib/util');

describe('EncodingParametersImpl', () => {
  describe('constructor', () => {
    combinationContext([
      [
        [undefined, null, 5000],
        x => `when maxAudioBitrate is ${typeof x === 'undefined'
          ? 'absent' : x === null ? 'null' : 'present'}`
      ],
      [
        [undefined, null, 6000],
        x => `when maxVideoBitrate is ${typeof x === 'undefined'
          ? 'absent' : x === null ? 'null' : 'present'}`
      ]
    ], ([maxAudioBitrate, maxVideoBitrate]) => {
      const encodingParmeters = [
        ['maxAudioBitrate', maxAudioBitrate],
        ['maxVideoBitrate', maxVideoBitrate]
      ].reduce((params, [prop, maxKindBitrate]) => {
        if (typeof maxKindBitrate !== 'undefined') {
          params[prop] = maxKindBitrate;
        }
        return params;
      }, {});

      let encodingParametersImpl;

      before(() => {
        encodingParametersImpl = new EncodingParametersImpl(encodingParmeters);
      });

      it('should return an EncodingParametersImpl instance', () => {
        assert(encodingParametersImpl instanceof EncodingParametersImpl);
      });

      [
        ['maxAudioBitrate', maxAudioBitrate],
        ['maxVideoBitrate', maxVideoBitrate]
      ].forEach(([prop, maxKindBitrate]) => {
        it(`should set the .${prop} property${maxKindBitrate ? '' : ' to null'}`, () => {
          assert.equal(encodingParametersImpl[prop], (maxKindBitrate ? encodingParmeters[prop] : null));
        });
      });
    });
  });

  describe('update', () => {
    const encodingParameters = {
      maxAudioBitrate: 5000,
      maxVideoBitrate: 2000
    };

    combinationContext([
      [
        [undefined, null, 5000, 6000],
        x => `when the new .maxAudioBitrate is ${
          typeof x === 'undefined'
            ? 'undefined'
            : !x
              ? 'null'
              : (x === encodingParameters.maxAudioBitrate ? 'the same as' : 'different from') + ' the existing value'
        }`
      ],
      [
        [undefined, null, 2000, 3000],
        x => `when the new .maxVideoBitrate is ${
          typeof x === 'undefined'
            ? 'undefined'
            : !x
              ? 'null'
              : (x === encodingParameters.maxVideoBitrate ? 'the same as' : 'different from') + ' the existing value'
        }`
      ]
    ], ([maxAudioBitrate, maxVideoBitrate]) => {
      const updatedEncodingParameters = [
        ['maxAudioBitrate', maxAudioBitrate],
        ['maxVideoBitrate', maxVideoBitrate]
      ].reduce((params, [prop, maxKindBitrate]) => {
        if (typeof maxKindBitrate !== 'undefined') {
          params[prop] = maxKindBitrate;
        }
        return params;
      }, {});

      let encodingParametersImpl;
      let changedEventCount = 0;

      before(() => {
        encodingParametersImpl = new EncodingParametersImpl(encodingParameters);
        encodingParametersImpl.on('changed', () => changedEventCount++);
        encodingParametersImpl.update(updatedEncodingParameters);
      });

      [
        ['maxAudioBitrate', maxAudioBitrate],
        ['maxVideoBitrate', maxVideoBitrate]
      ].forEach(([prop, maxKindBitrate]) => {
        const shouldNotUpdateProp = typeof maxKindBitrate === 'undefined' || maxKindBitrate === encodingParameters[prop];
        it(`should ${shouldNotUpdateProp ? 'not ' : ''}update the .${prop} property`, () => {
          assert.equal(encodingParametersImpl[prop], shouldNotUpdateProp ? encodingParameters[prop] : updatedEncodingParameters[prop]);
        });
      });

      const shouldFireChanged = ['maxAudioBitrate', 'maxVideoBitrate'].some(prop => {
        return prop in updatedEncodingParameters
          && updatedEncodingParameters[prop] !== encodingParameters[prop];
      });

      it(shouldFireChanged ? 'should emit "changed" once' : 'should not emit "changed"', () => {
        assert.equal(changedEventCount, shouldFireChanged ? 1 : 0);
      });
    });
  });
});
