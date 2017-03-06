'use strict';

var assert = require('assert');
var createLocalAudioTrack = require('../../../lib/createlocaltrack').audio;
var createLocalVideoTrack = require('../../../lib/createlocaltrack').video;
var sinon = require('sinon');

[
  [ 'Audio', createLocalAudioTrack ],
  [ 'Video', createLocalVideoTrack ]
].forEach(scenario => {
  var kind = scenario[0];
  var createLocalTrack = scenario[1];

  describe(`createLocal${kind}Track`, () => {
    context('when called with no constraints', () => {
      it(`should call createLocalTracks() with { ${kind.toLowerCase()}: true }`, () => {
        var options = {
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
        var options = {
          baz: 'zee',
          createLocalTracks: sinon.spy(() => Promise.resolve([
            { foo: 'bar' }
          ]))
        };

        var expectedConstraints = { baz: 'zee' };
        createLocalTrack(options);
        assert.deepEqual(options.createLocalTracks.args[0][0][kind.toLowerCase()], expectedConstraints);
      });
    });

    it('should resolve with the first item of the array with which createLocalTracks() resolves', () => {
      var options = {
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
