#!/usr/local/bin/node
var cheerio = require('cheerio');
var fs = require('fs');

var releaseDocs = process.argv[2];
if (!releaseDocs) {
  process.exit(1);
}

var classNames = [
  'AccessToken',
  'AudioTrack',
  'Conversation',
  'Endpoint',
  'index',
  'Invite',
  'LocalMedia',
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
    '<li><a href="Endpoint.html">Endpoint</a>' +
      '<ul style="margin-left: 1em">' +
        '<li><a href="AccessToken.html">AccessToken</a></li>' +
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
        '<li><a href="LocalMedia.html">LocalMedia</a></li>' +
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
