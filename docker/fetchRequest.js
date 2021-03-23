/* eslint-disable no-console */
'use strict';
const http = require('http');

let requestId = 200;
function fetchRequest(options, postData) {
  const thisRequest = requestId++;
  const logPrefix = `fetchRequest[${thisRequest}]: `;
  return new Promise((resolve, reject) => {
    let clientRequest = http.request(options, res => {
      const requestFailed = res.statusCode !== 200 && res.statusCode !== 201;
      if (requestFailed) {
        console.warn(logPrefix + 'requestFailed returned:', res.statusCode, options, postData);
      }
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', chunk => {
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          let parsedData;
          if (rawData) {
            parsedData = JSON.parse(rawData);
          }
          if (requestFailed) {
            console.warn(logPrefix + 'requestFailed2 returned:', res.statusCode, postData);
          }
          resolve(parsedData);
        } catch (e) {
          console.error(logPrefix + 'rejecting:', e);
          reject(e);
        }
      });
    });
    clientRequest.on('error', e => {
      console.error(logPrefix + 'rejecting:', e);
      reject(e);
    });

    if (postData) {
      clientRequest.write(postData);
    }
    clientRequest.end();
  });
}

module.exports = fetchRequest;

