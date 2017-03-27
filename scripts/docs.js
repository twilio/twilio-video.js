#!/usr/bin/env node
'use strict';

const cheerio = require('cheerio');
const path = require('path');
const spawnSync = require('child_process').spawnSync;
const stream = require('stream');
const vfs = require('vinyl-fs');

const docs = process.argv[2];

const publicClasses = [
  'lib/connect.js',
  'lib/createlocaltrack.js',
  'lib/createlocaltracks.js',
  'lib/room.js',
  'lib/media/track/index.js',
  'lib/media/track/audiotrack.js',
  'lib/media/track/localaudiotrack.js',
  'lib/media/track/localtrack.js',
  'lib/media/track/localvideotrack.js',
  'lib/media/track/videotrack.js',
  'lib/localparticipant.js',
  'lib/participant.js',
  'lib/stats/statsreport.js',
  'lib/stats/trackstats.js',
  'lib/stats/localtrackstats.js',
  'lib/stats/localaudiotrackstats.js',
  'lib/stats/localvideotrackstats.js',
  'lib/stats/remotetrackstats.js',
  'lib/stats/remoteaudiotrackstats.js',
  'lib/stats/remotevideotrackstats.js',
  'lib/util/twilio-video-errors.js',
  'lib/util/twilioerror.js'
];

const publicConstructors = [
  'LocalAudioTrack',
  'LocalVideoTrack'
];

const privateConstructors = [
  'AudioTrack',
  'Room',
  'LocalParticipant',
  'LocalTrack',
  'Participant',
  'Track',
  'VideoTrack',
  'StatsReport',
  'TrackStats',
  'LocalTrackStats',
  'LocalAudioTrackStats',
  'LocalVideoTrackStats',
  'RemoteTrackStats',
  'RemoteAudioTrackStats',
  'RemoteVideoTrackStats',
  'TwilioError'
];

const TwilioErrors = require('../lib/util/twilio-video-errors');
Object.keys(TwilioErrors).forEach(function(error) {
  privateConstructors.push(error);
});

spawnSync('node', [
  require.resolve('jsdoc/jsdoc'),
  '-d', docs,
  '-c', './jsdoc.conf',
  '-t', path.dirname(require.resolve('ink-docstrap')),
  '-R', './README.md'
].concat(publicClasses), {
  stdio: 'inherit'
});

vfs.src(path.join(docs, '*.html'))
  .pipe(map(transform))
  .pipe(vfs.dest(docs));

function transform(file) {
  var $ = cheerio.load(file.contents.toString());

  var filename = file.path.slice(file.base.length);
  var className = filename.split('.html')[0];
  var div;

  // Prefix public constructors.
  if (publicConstructors.indexOf(className) > -1) {
    div = $('.container-overview');
    var name = $('h4.name', div);
    name.html(name.html().replace(/new /, 'new <span style="color: #999">Twilio.Video.</span>'));
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

  // Add Google Analytics.
  var body = $('body');
  var bodyHtml = body.html();
  body.html(bodyHtml + [
    "<script>",
      "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){",
      "(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),",
      "m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)",
      "})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');",
      "ga('create', 'UA-2900316-33', 'auto');",
      "ga('send', 'pageview');",
    "</script>"
  ].join(''));

  file.contents = new Buffer($.html());
  return file;
}

function map(f) {
  return new stream.Transform({
    objectMode: true,
    transform: function transform(file, encoding, callback) {
      callback(null, f(file));
    }
  });
}
