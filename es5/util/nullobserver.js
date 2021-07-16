/* eslint-disable no-console */
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NullObserver = function () {
  function NullObserver(callback) {
    _classCallCheck(this, NullObserver);

    Object.defineProperties(this, {
      _callback: {
        value: callback
      }
    });
  }

  _createClass(NullObserver, [{
    key: 'observe',
    value: function observe() {}
  }, {
    key: 'unobserve',
    value: function unobserve() {}
  }, {
    key: 'makeVisible',
    value: function makeVisible(videoEl) {
      var visibleEntry = this._makeFakeEntry(videoEl, true);
      this._callback([visibleEntry]);
    }
  }, {
    key: 'makeInvisible',
    value: function makeInvisible(videoEl) {
      var invisibleEntry = this._makeFakeEntry(videoEl, false);
      this._callback([invisibleEntry]);
    }
  }, {
    key: '_makeFakeEntry',
    value: function _makeFakeEntry(videoElement, isIntersecting) {
      return { target: videoElement, isIntersecting: isIntersecting };
    }
  }]);

  return NullObserver;
}();

var NullIntersectionObserver = function (_NullObserver) {
  _inherits(NullIntersectionObserver, _NullObserver);

  function NullIntersectionObserver() {
    _classCallCheck(this, NullIntersectionObserver);

    return _possibleConstructorReturn(this, (NullIntersectionObserver.__proto__ || Object.getPrototypeOf(NullIntersectionObserver)).apply(this, arguments));
  }

  return NullIntersectionObserver;
}(NullObserver);

var NullResizeObserver = function (_NullObserver2) {
  _inherits(NullResizeObserver, _NullObserver2);

  function NullResizeObserver() {
    _classCallCheck(this, NullResizeObserver);

    return _possibleConstructorReturn(this, (NullResizeObserver.__proto__ || Object.getPrototypeOf(NullResizeObserver)).apply(this, arguments));
  }

  _createClass(NullResizeObserver, [{
    key: 'resize',
    value: function resize(videoEl) {
      var entry = this._makeFakeEntry(videoEl, true);
      this._callback([entry]);
    }
  }]);

  return NullResizeObserver;
}(NullObserver);

module.exports = { NullIntersectionObserver: NullIntersectionObserver, NullResizeObserver: NullResizeObserver, NullObserver: NullObserver };