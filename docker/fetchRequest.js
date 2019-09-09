/* eslint-disable no-console */
'use strict';
const http = require('http');

let requestId = 200;
function fetchRequest(options, postdata) {
  const thisRequest = requestId++;
  return new Promise((resolve, reject) => {
    let clientRequest = http.request(options, (res) => {
      const requestFailed = res.statusCode !== 200 && res.statusCode !== 201;
      if (requestFailed) {
        console.warn(`${thisRequest}: request returned:`, res.statusCode, options, postdata);
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
            console.warn(`${thisRequest}: request failed with:`, res.statusCode, parsedData);
          }
          resolve(parsedData);
        } catch (e) {
          console.warn(`${thisRequest}: error parsing data:`, rawData);
          reject(e);
        }
      });
    });
    clientRequest.on('error', e => {
      console.warn(`${thisRequest}: request failed`, e);
      reject(e);
    });

    if (postdata) {
      clientRequest.write(postdata);
    }
    clientRequest.end();
  });
}

module.exports = fetchRequest;

