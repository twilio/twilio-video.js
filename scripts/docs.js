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
  'lib/media/track/localdatatrack.js',
  'lib/media/track/localvideotrack.js',
  'lib/media/track/localaudiotrackpublication.js',
  'lib/media/track/localdatatrackpublication.js',
  'lib/media/track/localtrackpublication.js',
  'lib/media/track/localvideotrackpublication.js',
  'lib/media/track/remoteaudiotrack.js',
  'lib/media/track/remotedatatrack.js',
  'lib/media/track/remoteaudiotrackpublication.js',
  'lib/media/track/remotedatatrackpublication.js',
  'lib/media/track/remotetrackpublication.js',
  'lib/media/track/remotevideotrackpublication.js',
  'lib/media/track/remotevideotrack.js',
  'lib/media/track/trackpublication.js',
  'lib/media/track/videotrack.js',
  'lib/localparticipant.js',
  'lib/participant.js',
  'lib/remoteparticipant.js',
  'lib/stats/statsreport.js',
  'lib/stats/trackstats.js',
  'lib/stats/localtrackstats.js',
  'lib/stats/localaudiotrackstats.js',
  'lib/stats/localvideotrackstats.js',
  'lib/stats/networkqualityaudiostats.js',
  'lib/stats/networkqualitybandwidthstats.js',
  'lib/stats/networkqualityfractionloststats.js',
  'lib/stats/networkqualitylatencystats.js',
  'lib/stats/networkqualitymediastats.js',
  'lib/stats/networkqualityrecvstats.js',
  'lib/stats/networkqualitysendorrecvstats.js',
  'lib/stats/networkqualitysendstats.js',
  'lib/stats/networkqualitystats.js',
  'lib/stats/networkqualityvideostats.js',
  'lib/stats/remotetrackstats.js',
  'lib/stats/remoteaudiotrackstats.js',
  'lib/stats/remotevideotrackstats.js',
  'lib/util/twilio-video-errors.js',
  'lib/util/twilioerror.js'
];

const publicConstructors = [
  'LocalAudioTrack',
  'LocalVideoTrack',
  'LocalDataTrack'
];

const privateConstructors = [
  'AudioTrack',
  'Room',
  'LocalParticipant',
  'Participant',
  'LocalAudioTrackPublication',
  'LocalDataTrackPublication',
  'LocalTrackPublication',
  'LocalVideoTrackPublication',
  'RemoteAudioTrack',
  'RemoteDataTrack',
  'RemoteVideoTrack',
  'RemoteAudioTrackPublication',
  'RemoteDataTrackPublication',
  'RemoteTrackPublication',
  'RemoteVideoTrackPublication',
  'RemoteParticipant',
  'Track',
  'TrackPublication',
  'VideoTrack',
  'StatsReport',
  'TrackStats',
  'LocalTrackStats',
  'LocalAudioTrackStats',
  'LocalVideoTrackStats',
  'NetworkQualityAudioStats',
  'NetworkQualityBandwidthStats',
  'NetworkQualityFractionLostStats',
  'NetworkQualityLatencyStats',
  'NetworkQualityMediaStatsq',
  'NetworkQualityRecvStats',
  'NetworkQualitySendOrRecvStats',
  'NetworkQualitySendStats',
  'NetworkQualityStats',
  'NetworkQualityVideoStats',
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
