/*! ${name}.js ${version}

#include "LICENSE.md"
 */
'use strict';
(function(root) {
  var component = require('./twilio-rtc-conversations-bundle');
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return component; });
  } else {
    root.Twilio = root.Twilio || {};
    root.Twilio.AccessManager = root.Twilio.AccessManager || component.AccessManager;
    for (var componentName in component) {
      root.Twilio[componentName] = component[componentName];
    }
  }
})(window || global || /* eslint no-invalid-this:0 */ this);
