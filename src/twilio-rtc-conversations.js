/* jshint strict: false, undef: false */
var AccessToken = require('twilio-common').AccessToken;
var component = require('lib');
var componentName = 'Conversations';

// Uses CommonJS, AMD or browser globals to create a
// module using UMD (Universal Module Definition).
(function (root) {
  // AMD (Requirejs etc)
  if (typeof define === 'function' && define.amd) {
    define([], function() { return component; });
  // Browser globals
  } else {
    root.Twilio = root.Twilio || function Twilio() { };
    root.Twilio.AccessToken = root.Twilio.AccessToken || AccessToken;
    if (componentName) {
      root.Twilio[componentName] = component;
    } else {
      for (componentName in component) {
        root.Twilio[componentName] = component[componentName];
      }
    }
  }
})(window || global || this);
