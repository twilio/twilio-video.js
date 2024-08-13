/* eslint no-undefined:0 */
'use strict';
/**
 * @param {Array<number|undefined>} xs
 * @returns {number|undefined}
 */
function average(xs) {
    xs = xs.filter(function (x) { return typeof x === 'number'; });
    return xs.length < 1 ? undefined : xs.reduce(function (y, x) { return x + y; }) / xs.length;
}
module.exports = average;
//# sourceMappingURL=average.js.map