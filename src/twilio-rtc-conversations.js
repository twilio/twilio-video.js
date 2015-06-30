/* jshint strict: false, undef: false */
/** @namespace Twilio */
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
    root.Twilio[componentName] = component;
  }
})(window || global || this);
