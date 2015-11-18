/*! ${name}.js ${version}

#include "LICENSE.md"
 */
/* eslint strict:0 */
(function(root) {
  var Conversations = require('./twilio-conversations-bundle');
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Conversations; });
  } else {
    var Twilio = root.Twilio = root.Twilio || {};
    Twilio.Conversations = Twilio.Conversations || Conversations;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
