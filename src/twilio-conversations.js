/*! ${name}.js ${version}

#include "LICENSE.md"
 */
/* eslint strict:0 */
(function(root) {
  /* eslint "no-unused-vars": [2, {"vars": "all", "varsIgnorePattern": "a"}] */
  var appId = '';
  var appSecret = '';

  /* global callstats io jsSHA */
  /* eslint no-undef: 2 */
  /* eslint new-cap: [2, {"newIsCap": false}] */
  var callStats = new callstats(null, io, jsSHA);

  function csInitCallback(err, msg) {
    console.log('CallStats Initializing Status: err=' + err + 'msg=' + msg);
  }

  var Conversations = require('./twilio-conversations-bundle');
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Conversations; });
  } else {
    var Twilio = root.Twilio = root.Twilio || {};
    Twilio.Conversations = Twilio.Conversations || Conversations;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
