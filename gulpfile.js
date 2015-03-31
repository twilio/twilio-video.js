'use strict';

var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var gulp = require('gulp');
var jsdoc = require('gulp-jsdoc');
var jshint = require('gulp-jshint');
var runSequence = require('run-sequence');
var shell = require('gulp-shell');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var stylish = require('jshint-stylish');
var uglify = require('gulp-uglify');

var pkg = require('./package');
var name = pkg.name;
var version = pkg.version;

gulp.task('patch', shell.task([
  'patch -N node_modules/sip.js/src/SanityCheck.js ' +
    '<patch/disable_rfc3261_18_1_2.patch; true',
  'patch -N node_modules/sip.js/src/Hacks.js ' +
    '<patch/disable_masking.patch; true'
]));

gulp.task('lint', function() {
  return gulp.src('./lib/**.js')
    .pipe(jshint({
      evil: true,
      futurehostile: true,
      // globalstrict: true,
      laxbreak: true,
      node: true,
      predef: [
        'atob',
        'btoa',
        'XMLHttpRequest',
        '-Map',
        '-Set'
      ],
      strict: true,
      sub: true
    }))
    .pipe(jshint.reporter(stylish))
    .pipe(jshint.reporter('fail'));
});

gulp.task('test', shell.task('make test'));

gulp.task('build', function(done) {
  function bundler(minified) {
    var dest = './build/' + version + '/';
    var bundleName = name + '.' + version + '.' +
                     (!!minified ? 'min.' : '') + 'js';
    var unminified = browserify({
        entries: ['./browser/index.js'],
        debug: true
      }).bundle()
      .pipe(source(bundleName))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
    unminified = !minified ? unminified : unminified
      .pipe(uglify())
    return unminified
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(dest));
  }
  function build(bundler) {
    return function() {
      // WARN: We are racing here. I haven't seen any issues yet, but, if they
      // ever arise, suspect the following code.
      bundler(false);
      var result = bundler(true);
      result.once('end', done);
      return result;
    };
  }
  // return runSequence('lint', 'test', build(bundler));
  return runSequence('lint', build(bundler));
});

gulp.task('build-browser-test', function() {
  function bundler() {
    var dest = './build/' + version + '/test/';
    var bundleName = 'index.js';
    return browserify({
        entries: ['./test/spec/index.js'],
        debug: true
      }).bundle()
      .pipe(source(bundleName))
      .pipe(buffer())
      .pipe(gulp.dest(dest));
  }
  return bundler();
});

gulp.task('doc', function() {
  return gulp.src([
      './lib/conversation.js',
      './lib/endpoint.js',
      './lib/invite.js',
      './lib/media/sound.js',
      './lib/media/stream.js',
      './lib/remoteendpoint.js',
      './lib/signaling/dialog.js',
      './lib/signaling/invitetransaction/index.js',
      './lib/signaling/invitetransaction/inviteclienttransaction.js',
      './lib/signaling/invitetransaction/inviteservertransaction.js',
      './lib/signaling/invitetransaction/sipjsinviteclienttransaction.js',
      './lib/signaling/invitetransaction/sipjsinviteservertransaction.js',
      './lib/signalng/sipjsuseragent.js',
      './lib/signalng/useragent.js',
      './lib/signaling/sipjsdialog.js',
      './lib/token.js'
    ]).pipe(jsdoc('./build/' + version + '/doc/'));
});
