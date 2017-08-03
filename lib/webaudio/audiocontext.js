/* globals webkitAudioContext, AudioContext */
'use strict';

var NativeAudioContext = null;

if (typeof AudioContext !== 'undefined') {
  NativeAudioContext = AudioContext;
} else if (typeof webkitAudioContext !== 'undefined') {
  NativeAudioContext = webkitAudioContext;
}

try {
  module.exports = new NativeAudioContext();
} catch (error) {
  module.exports = null;
}
