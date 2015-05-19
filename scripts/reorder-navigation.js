#!/usr/local/bin/node
var cheerio = require('cheerio');
var fs = require('fs');

var releaseDocs = process.argv[2];
if (!releaseDocs) {
  process.exit(1);
}

var classNames = [
  'Twilio',
  'Twilio.AccessToken',
  'AudioTrack',
  'Conversation',
  'Twilio.Endpoint',
  'index',
  'Invite',
  'Twilio.LocalMedia',
  'Media',
  'Participant',
  'Track',
  'VideoTrack'
];

console.log('Rewriting navigation in');
classNames.forEach(function(className) {
  console.log(' - ' + className);
  var classPath = releaseDocs + '/' + className + '.html';
  var classFile = fs.readFileSync(classPath, 'utf8');
  var $ = cheerio.load(classFile);
  var nav = $('nav h3:contains("Classes") + ul');
  nav.html([
    '<li><a href="Twilio.Endpoint.html"><span style="color: #999">Twilio.</span>Endpoint</a>' +
      '<ul style="margin-left: 1em">' +
        '<li><a href="Twilio.AccessToken.html"><span style="color: #999">Twilio.</span>AccessToken</a></li>' +
        '<li><a href="Invite.html">Invite</a></li>' +
      '</ul>' +
    '</li>' +
    '<li><a href="Conversation.html">Conversation</a>' +
      '<ul style="margin-left: 1em">' +
        '<li><a href="Participant.html">Participant</a></li>' +
      '</ul>' +
    '</li>' +
    '<li><a href="Media.html">Media</a>' +
      '<ul style="margin-left: 1em">' +
        '<li><a href="Twilio.LocalMedia.html"><span style="color: #999">Twilio.</span>LocalMedia</a></li>' +
        '<li><a href="Track.html">Track</a>' +
          '<ul style="margin-left: 1em">' +
            '<li><a href="AudioTrack.html">AudioTrack</a></li>' +
            '<li><a href="VideoTrack.html">VideoTrack</a></li>' +
          '</ul>' +
        '</li>' +
      '</ul>' +
    '</li>'
  ].join());
  classFile = $.html();
  fs.writeFileSync(classPath, classFile, 'utf8');
  $('nav h3 + ul')
});
