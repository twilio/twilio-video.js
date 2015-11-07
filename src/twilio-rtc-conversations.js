/*! ${name}.js ${version}

#include "LICENSE.md"
 */
/* jshint strict: false, undef: false */
(function(root) {
  var component = require('./twilio-rtc-conversations-bundle');
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return component; });
  } else {
    root.Twilio = root.Twilio || {};
    root.Twilio.AccessManager = root.Twilio.AccessManager || component.AccessManager;
    for (componentName in component) {
      root.Twilio[componentName] = component[componentName];
    }
  }
})(window || global || this);
