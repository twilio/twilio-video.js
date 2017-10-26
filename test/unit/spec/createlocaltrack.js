'use strict';

const assert = require('assert');
const sinon = require('sinon');

const {
  audio: createLocalAudioTrack,
  video: createLocalVideoTrack
} = require('../../../lib/createlocaltrack');

[
  ['Audio', createLocalAudioTrack],
  ['Video', createLocalVideoTrack]
].forEach(([kind, createLocalTrack]) => {
  describe(`createLocal${kind}Track`, () => {
    context('when called with no constraints', () => {
      it(`should call createLocalTracks() with { ${kind.toLowerCase()}: true }`, () => {
        const options = {
          createLocalTracks: sinon.spy(() => Promise.resolve([
            { foo: 'bar' }
          ]))
        };

        createLocalTrack(options);
        assert(options.createLocalTracks.args[0][0][kind.toLowerCase()]);
      });
    });

    context('when called with constraints', () => {
      it(`should call createLocalTracks() with { ${kind.toLowerCase()}: constraints }`, () => {
        const options = {
          baz: 'zee',
          createLocalTracks: sinon.spy(() => Promise.resolve([
            { foo: 'bar' }
          ]))
        };

        const expectedConstraints = { baz: 'zee' };
        createLocalTrack(options);
        assert.deepEqual(options.createLocalTracks.args[0][0][kind.toLowerCase()], expectedConstraints);
      });
    });

    it('should resolve with the first item of the array with which createLocalTracks() resolves', () => {
      const options = {
        createLocalTracks: sinon.spy(() => Promise.resolve([
          { foo: 'bar' }
        ]))
      };

      return createLocalTrack(options).then(item => {
        assert.deepEqual(item, { foo: 'bar' });
      });
    });
  });
});
