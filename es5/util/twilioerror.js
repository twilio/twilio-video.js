'use strict';

/**
 * @extends Error
 * @property {number} code - Error code
 */

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TwilioError = function (_Error) {
  _inherits(TwilioError, _Error);

  /**
   * Creates a new {@link TwilioError}
   * @param {number} code - Error code
   * @param {string} [message] - Error message
   * @param {string} [fileName] - Name of the script file where error was generated
   * @param {number} [lineNumber] - Line number of the script file where error was generated
   */
  function TwilioError(code) {
    var _ref;

    _classCallCheck(this, TwilioError);

    var args = [].slice.call(arguments, 1);

    var _this = _possibleConstructorReturn(this, (_ref = TwilioError.__proto__ || Object.getPrototypeOf(TwilioError)).call.apply(_ref, [this].concat(_toConsumableArray(args))));

    var error = Error.apply(_this, args);
    error.name = 'TwilioError';

    Object.defineProperty(_this, 'code', {
      value: code,
      enumerable: true
    });

    Object.getOwnPropertyNames(error).forEach(function (prop) {
      Object.defineProperty(this, prop, {
        value: error[prop],
        enumerable: true
      });
    }, _this);
    return _this;
  }

  /**
   * Returns human readable string describing the error.
   * @returns {string}
   */


  _createClass(TwilioError, [{
    key: 'toString',
    value: function toString() {
      var message = this.message ? ': ' + this.message : '';
      return this.name + ' ' + this.code + message;
    }
  }]);

  return TwilioError;
}(Error);

module.exports = TwilioError;