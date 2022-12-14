'use strict';
/**
 * @param {Array<number|undefined>} xs
 * @returns {number}
 */
function sum(xs) {
    return xs.reduce(function (y, x) { return typeof x === 'number' ? x + y : y; }, 0);
}
module.exports = sum;
//# sourceMappingURL=sum.js.map