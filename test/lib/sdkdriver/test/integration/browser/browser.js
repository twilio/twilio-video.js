'use strict';

var init = require('../../../lib/browser').init;

init().then(function(dmp) {
  dmp.on('request', function(request) {
    if (request.data && request.data.type === 'sdkVersion') {
      request.sendResponse({ sdkVersion: Twilio.Video.version });
    }
  });
});
