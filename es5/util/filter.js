'use strict';
var Filter = /** @class */ (function () {
    function Filter(options) {
        options = Object.assign({
            getKey: function defaultGetKey(a) { return a; },
            getValue: function defaultGetValue(a) { return a; },
            isLessThanOrEqualTo: function defaultIsLessThanOrEqualTo(a, b) { return a <= b; }
        }, options);
        Object.defineProperties(this, {
            _getKey: {
                value: options.getKey
            },
            _getValue: {
                value: options.getValue
            },
            _isLessThanOrEqualTo: {
                value: options.isLessThanOrEqualTo
            },
            _map: {
                value: new Map()
            }
        });
    }
    Filter.prototype.toMap = function () {
        return new Map(this._map);
    };
    Filter.prototype.updateAndFilter = function (entries) {
        return entries.filter(this.update, this);
    };
    Filter.prototype.update = function (entry) {
        var key = this._getKey(entry);
        var value = this._getValue(entry);
        if (this._map.has(key) &&
            this._isLessThanOrEqualTo(value, this._map.get(key))) {
            return false;
        }
        this._map.set(key, value);
        return true;
    };
    return Filter;
}());
module.exports = Filter;
//# sourceMappingURL=filter.js.map