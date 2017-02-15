#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const { parse } = require('url');

const files = config({
  'app.js': {},
  'index.html': {},
  'twilio-video.min.js': {
    path: '../../../dist/twilio-video.min.js'
  }
});

/**
 * Configure files to be statically-served.
 * @param {Object<string, Object>} files
 * @returns {Object<string, Object>} configured
 */
function config(files) {
  return Object.keys(files).reduce((config, file) => {
    config[file] = {
      contentType: files[file].contentType || guessContentType(file),
      path: files[file].path || file
    };
    return config;
  }, {});
}

/**
 * Guess a file's content type.
 * @param {string} file
 * @returns {?string} contentType
 */
function guessContentType(file) {
  const i = file.lastIndexOf('.');
  if (i === -1) {
    return null;
  }
  const suffix = file.slice(i + 1);
  return {
    html: 'text/html',
    js: 'application/javascript'
  }[suffix] || null;
}

// Start serving static files.
const server = http.createServer((req, res) => {
  switch (req.method) {
    case 'OPTIONS':
      res.end('HTTP/1.1 200 OK\r\n\r\n');
      return;
    case 'GET':
      break;
    default:
      res.end('HTTP/1.1 405 Method Not Allowed\r\n\r\n');
      return;
  }
  const url = parse(req.url);
  const file = url.pathname.slice(1);
  if (file === '') {
    res.writeHead(302, { Location: `/index.html${url.search || ''}` });
    res.end();
    return;
  }
  const found = files[file];
  if (!found) {
    res.end('HTTP/1.1 404 Not Found\r\n\r\n');
    return;
  }
  res.setHeader('Content-Type', found.contentType);
  fs.createReadStream(found.path).pipe(res);
});

server.listen(5000);
