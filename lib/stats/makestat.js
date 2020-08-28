'use strict';
/**
 * Computes min, max, average for given array.
 * @param {Array<number>} values
 * @returns {{min: number, max: number: average: number}|null}
 */
function makeStat(values) {
  if (values.length >= 1) {
    let sum = 0;
    let min = values[0];
    let max = values[0];
    values.forEach(val => {
      min = Math.min(min, val);
      max = Math.max(max, val);
      sum += val;
    });
    const average = sum / values.length;
    return { min, max, average };
  }
  return null;
}

module.exports = makeStat;
