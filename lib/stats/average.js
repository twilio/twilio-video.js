/* eslint no-undefined:0 */
'use strict';

/**
 * @param {Array<number|undefined>} xs
 * @returns {number|undefined}
 */
function average(xs) {
  xs = xs.filter(x => typeof x === 'number');
  return xs.length < 1 ? undefined : xs.reduce((y, x) => x + y) / xs.length;
}

module.exports = average;
