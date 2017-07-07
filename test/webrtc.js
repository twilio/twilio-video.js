'use strict';

// NOTE(mroberts): Print out adapter.js information if we are running with
// adapter.js enabled.
if (typeof adapter !== 'undefined') {
  console.log(adapter);
}

require('./integration/spec/webrtc/rtcpeerconnection');
require('./integration/spec/webrtc/rtcsessiondescription');
