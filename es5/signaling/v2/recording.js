'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var RecordingSignaling = require('../recording');

/**
 * @extends RecordingSignaling
 */

var RecordingV2 = function (_RecordingSignaling) {
  _inherits(RecordingV2, _RecordingSignaling);

  /**
   * Construct a {@link RecordingV2}.
   */
  function RecordingV2() {
    _classCallCheck(this, RecordingV2);

    var _this = _possibleConstructorReturn(this, (RecordingV2.__proto__ || Object.getPrototypeOf(RecordingV2)).call(this));

    Object.defineProperties(_this, {
      _revision: {
        value: 1,
        writable: true
      }
    });
    return _this;
  }

  /**
   * Compare the {@link RecordingV2} to a {@link RecordingV2#Representation}
   * of itself and perform any updates necessary.
   * @param {RecordingV2#Representation} recording
   * @returns {this}
   * @fires RecordingSignaling#updated
   */


  _createClass(RecordingV2, [{
    key: 'update',
    value: function update(recording) {
      if (recording.revision < this._revision) {
        return this;
      }
      this._revision = recording.revision;
      return this.enable(recording.enabled);
    }
  }]);

  return RecordingV2;
}(RecordingSignaling);

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RecordingV2}
 * @typedef {object} RecordingV2#Representation
 * @property {boolean} enabled
 * @property {number} revision
 */

module.exports = RecordingV2;