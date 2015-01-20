var gulp = require('gulp');
var runSequence = require('run-sequence');

gulp.task('default', function(done) {
  runSequence('clean', 'lint', 'test', 'build', 'doc', done);
});

// Build
// =====

function getBundleName(minified) {
  var name = require('./package.json').name;
  var version = require('./package.json').version;
  return name + '.' + version + '.' + (!!minified ? 'min.' : '') + 'js';
};

// Patch
// -----

var shell = require('gulp-shell');

var patches = [
  'patch -N node_modules/sip.js/src/SanityCheck.js <patch/disable_rfc3261_18_1_2.patch; true',
  'patch -N node_modules/sip.js/src/WebRTC/MediaHandler.js <patch/replace_udptlsrtpsavpf_with_rtpsavpf.patch; true'
  // 'patch -F 0 -N node_modules/sip.js/src/WebRTC.js <patch/use_wrtc_for_webrtc_in_node.patch; true'
];

gulp.task('patch', shell.task(patches));

// Browserify
// ----------

var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
/* var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify'); */

var bundler = browserify({
  entries: ['./browser/index.js'],
  debug: true
});

function build(bundler) {
  return function() {
    return bundler
      .bundle()
      .pipe(source(getBundleName()))
      .pipe(buffer())
      /* .pipe(sourcemaps.init({ loadMaps: true }))
        // Add transformation tasks to the pipeline here.
        .pipe(uglify())
      .pipe(sourcemaps.write('./')) */
      .pipe(gulp.dest('./dist/'));
  };
}

gulp.task('build', ['clean-dist'], function() {
  return build(bundler)();
});

// Test
// ====

var mocha = require('gulp-mocha');

gulp.task('test', function() {
  // runSequence('unit-test', 'integration-test');
  runSequence('unit-test');
});

// Unit
// ----

gulp.task('unit-test', function() {
  return gulp.src(['test/unit/*.js'], { read: false })
    .pipe(mocha({
      reporter: 'spec',
      globals: {
        assert: require('assert')
      }
    }));
});

// Integration
// -----------

gulp.task('integration-test', function() {
  return gulp.src(['test/integration/*.js'], { read: false })
    .pipe(mocha({
      reporter: 'spec',
      globals: {
        assert: require('assert')
      }
    }));
});

// Lint
// ====

var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');

gulp.task('lint', function() {
  return gulp.src('./lib/**.js')
    .pipe(jshint({
      evil: true,
      // globalstrict: true,
      laxbreak: true,
      node: true,
      predef: [
        'atob',
        'btoa',
        '-Map',
        '-Set'
      ],
      strict: true,
      sub: true
    }))
    .pipe(jshint.reporter(stylish))
    .pipe(jshint.reporter('fail'));
});

// Doc
// ===

// JSDoc
// -----

var jsdoc = require('gulp-jsdoc');

gulp.task('doc', function() {
  // return gulp.src(['./lib/**.js', './lib/**/**.js', './lib/**/**/**.js'])
  return gulp.src([
      './lib/endpoint.js',
      './lib/participant.js',
      './lib/session.js',
      './lib/token/index.js'
    ]).pipe(jsdoc('./doc/'));
});

// Publish
// -------

var spawn = require('child_process').spawn;

gulp.task('publish', ['doc'], function(callback) {
  function done(error) {
    if (callback) {
      callback(error);
      callback = null;
    }
  }
  var update = spawn('appcfg.py',
                     'update www --oauth2'.split(' '),
                     { stdio: 'inherit' });
  update.on('error', done);
  update.on('close', function(code) {
    if (code) {
      done(new Error('child process exited with code ' + code));
    }
    done();
  });
});

// Clean
// =====

var del = require('del');

gulp.task('clean', ['clean-dist', 'clean-doc']);

gulp.task('clean-dist', function(done) {
  del(['./dist/'], done);
});

gulp.task('clean-doc', function(done) {
  del(['./doc/'], done);
});
