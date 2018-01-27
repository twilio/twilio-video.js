'use strict';

class Filter {
  constructor(options) {
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

  toMap() {
    return new Map(this._map);
  }

  updateAndFilter(entries) {
    return entries.filter(this.update, this);
  }

  update(entry) {
    const key = this._getKey(entry);
    const value = this._getValue(entry);
    if (this._map.has(key) &&
        this._isLessThanOrEqualTo(value, this._map.get(key))) {
      return false;
    }
    this._map.set(key, value);
    return true;
  }
}

module.exports = Filter;
