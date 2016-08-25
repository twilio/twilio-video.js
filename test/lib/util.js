'use strict';

function a(word) {
  return word.match(/^[aeiou]/) ? 'an' : 'a';
}

exports.a = a;
