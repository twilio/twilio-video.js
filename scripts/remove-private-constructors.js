#!/usr/local/bin/node
var cheerio = require('cheerio');
var fs = require('fs');

var releaseDocs = process.argv[2];
if (!releaseDocs) {
  process.exit(1);
}

var classNames = [
  'Conversation',
  'AudioTrack',
  'Invite',
  'LocalMedia',
  'Media',
  'Participant',
  'ScopedAuthenticationToken',
  'Track',
  'VideoTrack'
];

console.log('Stripping private constructors from');
classNames.forEach(function(className) {
  console.log(' - ' + className);
  var classPath = releaseDocs + '/' + className + '.html';
  var classFile = fs.readFileSync(classPath, 'utf8');
  var $ = cheerio.load(classFile);
  var div = $('.container-overview');
  $('h2', div).remove();
  $('h4.name', div).remove();
  $('div.description', div).remove();
  $('h5:contains(Parameters:)', div).remove();
  $('table.params', div).remove();
  classFile = $.html();
  fs.writeFileSync(classPath, classFile, 'utf8');
});
