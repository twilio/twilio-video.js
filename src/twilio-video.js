/*! ${name}.js ${version}

#include "LICENSE.md"
 */
/* eslint strict:0 */
(function(root) {
  var Video = require('./twilio-video-bundle');
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Video; });
  } else {
    var Twilio = root.Twilio = root.Twilio || {};
    Twilio.Video = Twilio.Video || Video;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
