'use strict';

function a(word) {
  return word.match(/^[aeiou]/) ? 'an' : 'a';
}

function randomName() {
  return Math.random().toString(36).slice(2);
}

exports.a = a;
exports.randomName = randomName;
