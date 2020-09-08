'use strict';
/**
 * Computes min, max, average for given array.
 * @param {Array<number>} values
 * @returns {{min: number, max: number: average: number}|null}
 */
function makeStat(values) {
  if (values.length) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((total, value) => total + value, 0) / values.length;
    return { min, max, average: average };
  }
  return null;
}

module.exports = makeStat;
