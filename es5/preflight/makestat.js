"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeStat = void 0;
/**
 * Computes min, max, average for given array.
 * @param {Array<number>} values
 * @returns {{min: number, max: number: average: number}|null}
 */
function makeStat(values) {
    if (values && values.length) {
        var min = Math.min.apply(Math, __spreadArray([], __read(values)));
        var max = Math.max.apply(Math, __spreadArray([], __read(values)));
        var average = values.reduce(function (total, value) { return total + value; }, 0) / values.length;
        return { min: min, max: max, average: average };
    }
    return null;
}
exports.makeStat = makeStat;
//# sourceMappingURL=makestat.js.map