/* jshint strict: false, undef: false */
var component = require('lib');
var componentName = null;

// Uses CommonJS, AMD or browser globals to create a
// module using UMD (Universal Module Definition).
(function (root) {
  // AMD (Requirejs etc)
  if (typeof define === 'function' && define.amd) {
    define([], function() { return component; });
  // Browser globals
  } else {
    root.Twilio = root.Twilio || function Twilio() { };
    if (componentName) {
      root.Twilio[componentName] = component;
    } else {
      for (componentName in component) {
        root.Twilio[componentName] = component[componentName];
      }
    }
  }
})(window || global || this);
