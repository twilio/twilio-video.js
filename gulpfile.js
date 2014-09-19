var gulp = require('gulp');
var gutil = require('gutil');

gulp.task('default', ['test', 'build'], function(){});

gulp.task('watch', function() {
  gulp.watch(['./lib/**', './test/**'], ['test', 'build']);
});

// Building
// ========

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

gulp.task('build', function() {
  var bundler = browserify({
    entries: ['./lib/browser.js'],
    debug: true
  });
  var bundler = function() {
    return bundler
      .bundle()
      .on('error', gutil.log)
      .pipe(source(getBundlerName()))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
        // Add transformation tasks to the pipeline here.
        .pipe(uglify())
      .pipe(sourcemaps.write('./'))*/
      .pipe(gulp.dest('./dist/'));
  };
});

var watchify = require('watchify');

gulp.task('watch-build', function() {
  var bundler = browserify({
    entries: ['./lib/browser.js'],
    debug: true
  });
  bundler = watchify(bundler, watchify.args);
  bundler.on('update', rebundle);
  function rebundle() {
    return bundler.bundle()
      .on('error', gutil.log)
      .pipe(source(getBundlerName()))
      .pipe(gulp.dest('./dist/'));
  }
  return rebundle();
});

// Test
// ====

var mocha = require('gulp-mocha');

gulp.task('test', ['unit-test', 'functional-test'], function(){});

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
    }))
    .on('error', gutil.log);
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
    .on('error', gutil.log);
});

gulp.task('watch-functional-test', function() {
  gulp.watch(['lib/**', 'test/functional/*.js'], ['functional-test']);
});

// Lint
// ====

gulp.task('lint', function() {
});
