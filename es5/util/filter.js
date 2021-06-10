'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Filter = function () {
  function Filter(options) {
    _classCallCheck(this, Filter);

    options = Object.assign({
      getKey: function defaultGetKey(a) {
        return a;
      },
      getValue: function defaultGetValue(a) {
        return a;
      },
      isLessThanOrEqualTo: function defaultIsLessThanOrEqualTo(a, b) {
        return a <= b;
      }
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

  _createClass(Filter, [{
    key: 'toMap',
    value: function toMap() {
      return new Map(this._map);
    }
  }, {
    key: 'updateAndFilter',
    value: function updateAndFilter(entries) {
      return entries.filter(this.update, this);
    }
  }, {
    key: 'update',
    value: function update(entry) {
      var key = this._getKey(entry);
      var value = this._getValue(entry);
      if (this._map.has(key) && this._isLessThanOrEqualTo(value, this._map.get(key))) {
        return false;
      }
      this._map.set(key, value);
      return true;
    }
  }]);

  return Filter;
}();

module.exports = Filter;