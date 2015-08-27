#!/usr/local/bin/node
var cheerio = require('cheerio');
var fs = require('fs');

var releaseDocs = process.argv[2];
if (!releaseDocs) {
  process.exit(1);
}

var classNames = [
  'AccessToken',
  'Endpoint',
  'LocalMedia'
];

console.log('Prefixing public constructors from');
classNames.forEach(function(className) {
  console.log(' - ' + className);
  var classPath = releaseDocs + '/' + className + '.html';
  var classFile = fs.readFileSync(classPath, 'utf8');
  var $ = cheerio.load(classFile);
  var div = $('.container-overview');
  var name = $('h4.name', div);
  name.html(name.html().replace(/new /, 'new <span style="color: #999">Twilio.</span>'));
  classFile = $.html();
  fs.writeFileSync(classPath, classFile, 'utf8');
});
