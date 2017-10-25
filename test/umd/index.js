'use strict';

const phantom = require('phantom');
const requirejs = require('requirejs');

const version = require('../../package.json').version;

const publicVars = [
  'connect',
  'createLocalAudioTrack',
  'createLocalTracks',
  'createLocalVideoTrack',
  'isSupported',
  'LocalAudioTrack',
  'LocalDataTrack',
  'LocalVideoTrack'
];

describe('UMD', function() {
  this.timeout(5000);

  describe('RequireJS (browser)', function() {
    let page;
    let instance;

    beforeEach(function() {
      return phantom.create([]).then(function(_instance) {
        instance = _instance;
        return instance.createPage();
      }).then(function(_page) {
        page = _page;
      });
    });

    it(`should receive a video object with ${publicVars.join(', ')} properties (unminified)`, function(done) {
      page.on('onCallback', function(res) {
        if (res.status === 'success') {
          if (res.version === version) {
            return done();
          } else {
            return done(new Error('Version mismatch'));
          }
        } else {
          return done(new Error(res.reason));
        }
      });

      page.open(__dirname + '/require-browser/index.html');
    });

    it(`should receive a video object with ${publicVars.join(', ')} properties (minified)`, function(done) {
      page.on('onCallback', function(res) {
        if (res.status === 'success') {
          if (res.version === version) {
            return done();
          } else {
            return done(new Error('Version mismatch'));
          }
        } else {
          return done(new Error(res.reason));
        }
      });

      page.open(__dirname + '/require-browser/min.html');
    });

    afterEach(function() {
      page.close();
      instance.exit();
    });
  });
});

