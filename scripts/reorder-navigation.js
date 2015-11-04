#!/usr/local/bin/node
var cheerio = require('cheerio');
var fs = require('fs');

var releaseDocs = process.argv[2];
if (!releaseDocs) {
  process.exit(1);
}

var files = fs.readdirSync(releaseDocs).filter(function(file) {
  return file.endsWith('.html');
});

console.log('Rewriting navigation in');
files.forEach(function(filePath) {
  filePath = releaseDocs + '/' + filePath;
  console.log(' - ' + filePath);
  var file = fs.readFileSync(filePath, 'utf8');
  var $ = cheerio.load(file);
  var nav = $('nav');
  nav.html([
    '<h2>' +
      '<a href="index.html">Home</a>' +
    '</h2>' +
    '<h3>Classes</h3>' +
    '<ul>' +
    '<li><a href="Client.html"><span style="color: #999">Conversations.</span>Client</a>' +
      '<ul style="margin-left: 1em">' +
        '<li><a href="AccessToken.html"><span style="color: #999">Conversations.</span>AccessToken</a></li>' +
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
        '<li><a href="LocalMedia.html"><span style="color: #999">Conversations.</span>LocalMedia</a></li>' +
        '<li><a href="Track.html">Track</a>' +
          '<ul style="margin-left: 1em">' +
            '<li><a href="AudioTrack.html">AudioTrack</a></li>' +
            '<li><a href="VideoTrack.html">VideoTrack</a></li>' +
          '</ul>' +
        '</li>' +
      '</ul>' +
    '</li>' +
    '</ul>'
  ].join());
  file = $.html();
  fs.writeFileSync(filePath, file, 'utf8');
});
