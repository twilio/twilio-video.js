'use strict';

/**
 * @param {Array<number|undefined>} xs
 * @returns {number}
 */
function sum(xs) {
  return xs.reduce((y, x) => typeof x === 'number' ? x + y : y, 0);
}

module.exports = sum;
