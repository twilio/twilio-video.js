'use strict';

var browserify = require('browserify');
var cheerio = require('cheerio');
var del = require('del');
var eslint = require('eslint/lib/cli');
var fs = require('fs');
var gulp = require('gulp');
var insert = require('gulp-insert');
var mkdirp = require('mkdirp');
var newer = require('gulp-newer');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var runSequence = require('run-sequence');
var source = require('vinyl-source-stream');
var spawn = require('child_process').spawn;
var streamFromPromise = require('stream-from-promise');
var through = require('through2');
var uglify = require('gulp-uglify');
var util = require('gulp-util');

var pkg = require('./package');
var name = pkg.name;
var main = pkg.main;
var version = pkg.version;

var license = 'LICENSE.md';
var linted = '.linted';
var mocha = 'node_modules/mocha/bin/_mocha';
var jsdoc = 'node_modules/jsdoc/jsdoc.js';

var integrationTested = '.integration-tested';
var integrationTestGlob = 'test/integration/**/*.js';
var integrationTestIndex = 'test/integration/index.js';

var unitTested = '.unit-tested';
var unitTestGlob = 'test/unit/**/*.js';
var unitTestIndex = 'test/unit/index.js';

var lib = 'lib';
var libJsGlob = 'lib/**/*.js';

var src = 'src';
var srcJs = src + '/' + name + '.js';
var bundleJs = name + '-bundle.js';
var srcBundleJs = src + '/' + bundleJs;

var dist = 'dist';
var js = name + '.js';
var minJs = name + '.min.js';
var distJs = dist + '/' + js;
var distMinJs = dist + '/' + minJs;

var distDocs = dist + '/docs';

var publicClasses = [
  'lib/client.js',
  'lib/conversation.js',
  'lib/incominginvite.js',
  'lib/media/index.js',
  'lib/media/localmedia.js',
  'lib/media/track/index.js',
  'lib/media/track/audiotrack.js',
  'lib/media/track/localaudiotrack.js',
  'lib/media/track/localtrack.js',
  'lib/media/track/localvideotrack.js',
  'lib/media/track/videotrack.js',
  'lib/outgoinginvite.js',
  'lib/participant.js'
];

var publicConstructors = [
  'Client',
  'LocalMedia'
];

var privateConstructors = [
  'AudioTrack',
  'Conversation',
  'IncomingInvite',
  'LocalAudioTrack',
  'LocalTrack',
  'LocalVideoTrack',
  'Media',
  'OutgoingInvite',
  'Participant',
  'Track',
  'VideoTrack'
];

gulp.task('default', [distMinJs, distDocs]);

gulp.task('clean', function() {
  return Promise.all([
    del(dist),
    del(integrationTested),
    del(linted),
    del(srcBundleJs),
    del(unitTested)
  ]);
});

// Lint
// ----

gulp.task(linted, function() {
  if (process.env.SKIP_LINT) {
    return;
  }
  return lint([libJsGlob, srcJs], newer(linted))
    .then(function(changed) {
      if (changed.length) {
        fs.writeFile(linted, '');
      }
    });
});

gulp.task('lint', function() {
  return lint([libJsGlob, srcJs]);
});

function lint(files, filter) {
  return new Promise(function(resolve, reject) {
    return gulp.src(files, { read: false })
      .pipe(filter || util.noop())
      .pipe(then(function(files) {
        if (files.length) {
          var paths = getPaths(files);
          var code = eslint.execute(paths.join(' '));
          if (code) {
            reject(new util.PluginError('lint', new Error('ESLint error')));
            return;
          }
        }
        resolve(files);
      }));
  });
}

// Test
// ----

gulp.task('test', function() {
  return runSequence('unit-test', 'integration-test');
});

// Unit Test
// ---------

gulp.task(unitTested, function() {
  if (process.env.SKIP_TEST || process.env.SKIP_UNIT) {
    return;
  }
  return unitTest([libJsGlob, unitTestGlob], newer(unitTested))
    .then(function(changed) {
      if (changed.length) {
        fs.writeFile(unitTested, '');
      }
    });
});

gulp.task('unit-test', function() {
  return unitTest([libJsGlob, unitTestGlob]);
});

function unitTest(files, filter) {
  return new Promise(function(resolve, reject) {
    return gulp.src(files, { read: false })
      .pipe(filter || util.noop())
      .pipe(then(function(files) {
        if (files.length) {
          var child = safeSpawn('node',
            [mocha, unitTestIndex],
            { stdio: 'inherit' });
          child.on('close', function(code) {
            if (code) {
              reject(new util.PluginError('unit-test', new Error('Mocha error')));
              return;
            }
            resolve(files);
          });
          return;
        }
        resolve(files);
      }));
  });
}

// Integration Test
// ----------------

gulp.task(integrationTested, function() {
  if (process.env.SKIP_TEST || process.env.SKIP_INTEGRATION) {
    return;
  }
  return integrationTest([libJsGlob, integrationTestGlob], newer(integrationTested))
    .then(function(changed) {
      if (changed.length) {
        fs.writeFile(integrationTested, '');
      }
    });
});

gulp.task('integration-test', function() {
  return integrationTest([libJsGlob, integrationTestGlob]);
});

function integrationTest(files, filter) {
  return new Promise(function(resolve, reject) {
    return gulp.src(files, { read: false })
      .pipe(filter || util.noop())
      .pipe(then(function(files) {
        if (files.length) {
          var child = safeSpawn('node',
            [mocha, integrationTestIndex],
            { stdio: 'inherit' });
          child.on('close', function(code) {
            if (code) {
              reject(new util.PluginError('integration-test', new Error('Mocha error')));
              return;
            }
            resolve(files);
          });
          return;
        }
        resolve(files);
      }));
  });
}

// src/twilio-conversations-bundle.js
// ----------------------------------

gulp.task(srcBundleJs, function(done) {
  return runSequence(
    linted,
    unitTested,
    integrationTested,
    function() {
      var id;
      return gulp.src(libJsGlob, { read: false })
        .pipe(newer(srcBundleJs))
        .pipe(then(function() {
          var b = browserify();
          b.add(main);
          b.on('dep', function(dep) {
            if (dep.entry) {
              id = id || dep.id;
            }
          });
          return b.bundle();
        }))
        .pipe(source(bundleJs))
        .pipe(gulp.dest(src))
        .once('error', done)
        .once('end', function() {
          return gulp.src([srcBundleJs])
            .pipe(insert.wrap('(function unpack(){var id=' + id + ', bundle=',
                              'return bundle(id)})();'))
            .pipe(gulp.dest(src))
            .once('error', done)
            .once('end', done);
        });
    }
  );
});

// dist/twilio-conversations.js
// ----------------------------

gulp.task(distJs, [srcBundleJs], function() {
  return gulp.src(srcBundleJs)
    .pipe(newer(distJs))
    .pipe(then(function(files) {
      var nameRegExp = /\${name}/;
      var versionRegExp = /\${version}/;
      var srcBundleJsContents = files[0].contents;
      var licenseContents;
      return gulp.src(license)
        .pipe(then(function(files) {
          licenseContents = files[0].contents;
          return gulp.src(srcJs)
            .pipe(replace(nameRegExp, name))
            .pipe(replace(versionRegExp, version))
            .pipe(replace('#include "' + license + '"', licenseContents))
            .pipe(replace("require('./" + bundleJs.replace(/.js$/, '') + "');", srcBundleJsContents));
        }));
    }))
    .pipe(rename(js))
    .pipe(gulp.dest(dist));
});

// dist/twilio-conversations.min.js
// --------------------------------

gulp.task(distMinJs, [distJs], function() {
  if (process.env.SKIP_MINIFY) {
    return;
  }
  var firstComment = true;
  return gulp.src(distJs)
    .pipe(newer(distMinJs))
    .pipe(uglify({
      output: {
        ascii_only: true
      },
      preserveComments: function() {
        if (firstComment) {
          firstComment = false;
          return true;
        }
        return false;
      }
    }))
    .pipe(rename(minJs))
    .pipe(gulp.dest(dist));
});

// dist/docs
// ---------

gulp.task(distDocs, function() {
  if (process.env.SKIP_DOCS) {
    return;
  }
  return gulp.src([libJsGlob, srcJs], { read: false })
    .pipe(newer(distDocs + '/index.html'))
    .pipe(thenP(function() {
      return del(distDocs).then(function() {
        return new Promise(function(resolve, reject) {
          var child = safeSpawn('node',
            [jsdoc, '-d', distDocs, '-c', 'jsdoc.conf'].concat(publicClasses),
            { stdio: 'inherit' });
          child.on('close', function(code) {
            if (code) {
              reject(new util.PluginError('docs', new Error('JSDoc error')));
              return;
            }
            resolve();
          });
        });
      });
    }))
    .pipe(then(function() {
      return gulp.src(distDocs + '/*.html');
    }))
    .pipe(map(function(file) {
      var $ = cheerio.load(file.contents.toString());

      var filename = file.path.slice(file.base.length);
      var className = filename.split('.html')[0];
      var div;

      // Prefix public constructors.
      if (publicConstructors.indexOf(className) > -1) {
        div = $('.container-overview');
        var name = $('h4.name', div);
        name.html(name.html().replace(/new /, 'new <span style="color: #999">Twilio.Conversations.</span>'));
      }

      // Remove private constructors.
      if (privateConstructors.indexOf(className) > -1) {
        div = $('.container-overview');
        $('h2', div).remove();
        $('h4.name', div).remove();
        $('div.description', div).remove();
        $('h5:contains(Parameters:)', div).remove();
        $('table.params', div).remove();
      }

      // Rewrite navigation.
      var nav = $('nav');
      nav.html([
        '<h2>',
          '<a href="index.html">Home</a>',
        '</h2>',
        '<h3>Classes</h3>',
        '<ul>',
          '<li><a href="Client.html"><span style="color: #999">Twilio.Conversations.</span>Client</a>',
            '<ul style="margin-left: 1em">',
              '<li><a href="IncomingInvite.html">IncomingInvite</a></li>',
              '<li><a href="OutgoingInvite.html">OutgoingInvite</a></li>',
            '</ul>',
          '</li>',
          '<li><a href="Conversation.html">Conversation</a>',
            '<ul style="margin-left: 1em">',
              '<li><a href="Participant.html">Participant</a></li>',
            '</ul>',
          '</li>',
          '<li><a href="Media.html">Media</a>',
            '<ul style="margin-left: 1em">',
              '<li><a href="LocalMedia.html"><span style="color: #999">Twilio.Conversations.</span>LocalMedia</a></li>',
              '<li><a href="LocalTrack.html">LocalTrack</a>',
              '<li><a href="Track.html">Track</a>',
                '<ul style="margin-left: 1em">',
                  '<li><a href="AudioTrack.html">AudioTrack</a>',
                    '<ul style="margin-left: 1em">',
                      '<li><a href="LocalAudioTrack.html">LocalAudioTrack</a></li>',
                    '</ul>',
                  '</li>',
                  '<li><a href="VideoTrack.html">VideoTrack</a>',
                    '<ul style="margin-left: 1em">',
                      '<li><a href="LocalVideoTrack.html">LocalVideoTrack</a></li>',
                    '</ul>',
                  '</li>',
                '</ul>',
              '</li>',
            '</ul>',
          '</li>',
        '</ul>'
      ].join(''));

      file.contents = new Buffer($.html());
      return file;
    }))
    .pipe(gulp.dest(distDocs));
});

gulp.task('docs', [distDocs]);

function getPaths(files) {
  return files.map(function(file) {
    return file.path;
  });
}

function then(next) {
  var as = [];
  return through.obj(function(a, _, done) {
    as.push(a);
    done();
  }, function(end)  {
    var stream = next(as);
    if (!stream) {
      return end();
    }
    stream.on('data', this.push.bind(this));
    stream.on('end', end);
  });
}

function thenP(nextP) {
  return then(function nextS(as) {
    var promise = nextP(as);
    var stream = streamFromPromise(promise);
    return stream;
  });
}

function map(fn) {
  return through.obj(function(a, _, done) {
    this.push(fn(a));
    return done();
  });
}

function safeSpawn() {
  var child = spawn.apply(this, arguments);
  safeSpawn._children.push(child);
  return child;
}

safeSpawn._children = [];

safeSpawn.killAll = function killAll() {
  safeSpawn._children.splice(0).forEach(function(child) {
    child.kill();
  });
};

process.on('SIGINT', function() {
  safeSpawn.killAll();
  process.exit(1);
});
