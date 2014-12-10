var gulp = require('gulp');
var runSequence = require('run-sequence');

gulp.task('default', function(done) {
  runSequence('clean', 'lint', 'test', 'build', 'doc', done);
});

gulp.task('watch', function() {
  gulp.watch(['./lib/**', './test/**'], ['lint', 'test', 'build']);
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
  'patch -N node_modules/sip.js/src/WebRTC/MediaHandler.js <patch/replace_udptlsrtpsavpf_with_rtpsavpf.patch; true',
  'patch -F 0 -N node_modules/sip.js/src/WebRTC.js <patch/use_wrtc_for_webrtc_in_node.patch; true'
];

gulp.task('patch', shell.task(patches));

// Browserify
// ----------

var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');

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
      .pipe(sourcemaps.init({ loadMaps: true }))
        // Add transformation tasks to the pipeline here.
        .pipe(uglify())
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./dist/'));
  };
}

gulp.task('build', ['clean-dist'], function() {
  return build(bundler)();
});

var watchify = require('watchify');

gulp.task('watch-build', function() {
  watchifiedBundler = watchify(bundler, watchify.args);
  var rebuild = build(watchifiedBundler);
  watchifiedBundler.on('update', rebuild);
  return rebuild();
});

// ### twilio.js 1.2 Adapter

var adapterBundler = browserify({
  entries: ['./browser/1.2-adapter.js'],
  debug: true
});

function getAdapterBundleName(minified) {
  return 'twilio.' + (!!minified ? 'min.' : '') + 'js';
};

function buildAdapter(bundler) {
  return function() {
    return bundler
      .bundle()
      .pipe(source(getAdapterBundleName()))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
        // Add transformation tasks to the pipeline here.
        // .pipe(uglify())
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest('./dist/twiliojs/1.2/'));
  };
}

gulp.task('build-adapter', function() {
  return buildAdapter(adapterBundler)();
});

gulp.task('watch-build-adapter', function() {
  watchifiedBundler = watchify(adapterBundler, watchify.args);
  var rebuild = buildAdapter(watchifiedBundler);
  watchifiedBundler.on('update', rebuild);
  return rebuild();
});

// Test
// ====

var mocha = require('gulp-mocha');

gulp.task('test', function() {
  runSequence('unit-test', 'functional-test');
});

gulp.task('watch-test', function() {
  gulp.watch(['./lib/**', './test/**'], ['test']);
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

gulp.task('watch-unit-test', function() {
  gulp.watch(['lib/**', 'test/unit/*.js'], ['unit-test']);
});

// Functional
// ----------

gulp.task('functional-test', function(callback) {
  var getVars = require('./test/environment');
  getVars.then(function(vars) {
    for (var name in vars) {
      var value = vars[name];
      process.env[name] = value;
    }
    gulp.src(['test/functional/*.js'], { read: false })
      .pipe(mocha({
        reporter: 'spec',
        globals: {
          assert: require('assert')
        }
      }))
      .pipe(callback);
  });
});

gulp.task('watch-functional-test', function() {
  gulp.watch(['lib/**', 'test/functional/*.js'], ['functional-test']);
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
var template = require('jaguarjs-jsdoc');

gulp.task('doc', function() {
  return gulp.src(['./lib/**.js', './lib/**/**.js', './lib/**/**/**.js'])
    .pipe(jsdoc('./doc/'));
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
