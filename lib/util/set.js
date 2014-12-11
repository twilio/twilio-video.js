'use strict';

var Set = require('es6-set');

Set.prototype.map = function map(f) {
  var result = new Set();
  this.forEach(function(a) {
    result.add(f(a));
  });
  return result;
};

module.exports = Set;
