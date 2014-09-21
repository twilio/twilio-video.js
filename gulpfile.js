var gulp = require('gulp');
var runSequence = require('run-sequence');

gulp.task('default', function(done) {
  runSequence('clean', ['test', 'lint'], ['doc', 'build'], done);
});

gulp.task('watch', function() {
  gulp.watch(['./lib/**', './test/**'], ['test', 'lint', 'build']);
});

// Build
// =====

function getBundleName(minified) {
  var minified = typeof minified === 'undefined' ? false : minified;
  var name = require('./package.json').name;
  var version = require('./package.json').version;
  return name + '.' + version + '.' + (minified ? 'min.' : '') + 'js';
};

// Browserify
// ----------

var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');

var bundler = browserify({
  entries: ['./lib/browser.js'],
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

// Test
// ====

var mocha = require('gulp-mocha');

gulp.task('test', ['unit-test', 'functional-test']);

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

gulp.task('functional-test', function() {
  return gulp.src(['test/functional/*.js'], { read: false })
    .pipe(mocha({
      reporter: 'spec',
      globals: {
        assert: require('assert')
      }
    }))
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
      laxbreak: true
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
  return gulp.src('./lib/**.js')
    .pipe(jsdoc('./doc/'));
});

// Publish
// -------

var spawn = require('child_process').spawn;

gulp.task('publish-doc', ['doc'], function(callback) {
  function done(error) {
    if (callback) {
      callback(error);
      callback = null;
    }
  }
  var update = spawn('appcfg.py',
                     'update . --oauth2'.split(' '),
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
