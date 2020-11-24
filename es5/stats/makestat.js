'use strict';
/**
 * Computes min, max, average for given array.
 * @param {Array<number>} values
 * @returns {{min: number, max: number: average: number}|null}
 */

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function makeStat(values) {
  if (values.length) {
    var min = Math.min.apply(Math, _toConsumableArray(values));
    var max = Math.max.apply(Math, _toConsumableArray(values));
    var average = values.reduce(function (total, value) {
      return total + value;
    }, 0) / values.length;
    return { min: min, max: max, average: average };
  }
  return null;
}

module.exports = makeStat;