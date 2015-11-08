/*! ${name}.js ${version}

#include "LICENSE.md"
 */
/* eslint strict:0 */
(function(root) {
  var conversationsBundle = require('./twilio-rtc-conversations-bundle');
  var Conversations = conversationsBundle(1);
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Conversations; });
  } else {
    root.Twilio = root.Twilio || {};
    root.Twilio.AccessManager = root.Twilio.AccessManager || Conversations.AccessManager;
    root.Twilio.Conversations = root.Twilio.Conversations || Conversations;
  }
})(window || global || /* eslint no-invalid-this:0 */ this);
