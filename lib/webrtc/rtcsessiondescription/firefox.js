/* globals mozRTCSessionDescription, RTCSessionDescription */
'use strict';

module.exports = typeof RTCSessionDescription !== 'undefined'
  ? RTCSessionDescription
  : mozRTCSessionDescription;
