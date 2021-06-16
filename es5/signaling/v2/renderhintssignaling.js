/* eslint callback-return:0 */
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MediaSignaling = require('./mediasignaling');

var _require = require('../../util'),
    isDeepEqual = _require.isDeepEqual;

var messageId = 1;

var RenderHintsSignaling = function (_MediaSignaling) {
  _inherits(RenderHintsSignaling, _MediaSignaling);

  /**
   * Construct a {@link RenderHintsSignaling}.
   */
  function RenderHintsSignaling(getReceiver, options) {
    _classCallCheck(this, RenderHintsSignaling);

    var _this = _possibleConstructorReturn(this, (RenderHintsSignaling.__proto__ || Object.getPrototypeOf(RenderHintsSignaling)).call(this, getReceiver, 'render_hints', options));

    Object.defineProperties(_this, {
      _trackSidsToRenderHints: {
        value: new Map()
      },
      _dirtyTrackSids: {
        value: new Set()
      },
      _isResponsePending: {
        value: false,
        writable: true
      }
    });

    _this.on('ready', function (transport) {
      transport.on('message', function (message) {
        _this._log.debug('Incoming: ', message);
        switch (message.type) {
          case 'render_hints':
            _this._processHintResults(message && message.subscriber && message.subscriber.hints || []);
            break;
          default:
            _this._log.warn('Unknown message type: ', message.type);
            break;
        }
      });

      // NOTE(mpatwardhan): When transport is set (either 1st time of after vms failover)
      // resend all track states. For this simply mark all tracks as dirty.
      Array.from(_this._trackSidsToRenderHints.keys()).forEach(function (trackSid) {
        return _this._dirtyTrackSids.add(trackSid);
      });
      _this._sendHints();
    });
    return _this;
  }

  _createClass(RenderHintsSignaling, [{
    key: '_processHintResults',
    value: function _processHintResults(hintResults) {
      var _this2 = this;

      this._isResponsePending = false;
      hintResults.forEach(function (hintResult) {
        if (hintResult.result !== 'OK') {
          _this2._log.debug('Server error processing hint:', hintResult);
        }
      });
      this._sendHints();
    }
  }, {
    key: '_sendHints',
    value: function _sendHints() {
      var _this3 = this;

      if (!this._transport || this._isResponsePending || this._dirtyTrackSids.size === 0) {
        return;
      }

      var hints = [];
      Array.from(this._dirtyTrackSids).forEach(function (trackSid) {
        var mspHint = _this3._trackSidsToRenderHints.get(trackSid);
        hints.push(mspHint);
        _this3._dirtyTrackSids.delete(trackSid);
      });

      var payLoad = {
        type: 'render_hints',
        subscriber: {
          id: messageId++,
          hints: hints
        }
      };
      this._log.debug('Outgoing: ', payLoad);
      this._transport.publish(payLoad);
      this._isResponsePending = true;
    }

    /**
     * @param {Track.SID} trackSid
     * @param {ClientRenderHint} renderHint
     */

  }, {
    key: 'setTrackHint',
    value: function setTrackHint(trackSid, renderHint) {
      // convert hint to msp format
      var mspHint = {
        'track': trackSid
      };

      if ('enabled' in renderHint) {
        mspHint.enabled = !!renderHint.enabled;
      }

      if (renderHint.renderDimensions) {
        // eslint-disable-next-line camelcase
        mspHint.render_dimensions = renderHint.renderDimensions;
      }

      var oldHint = this._trackSidsToRenderHints.get(trackSid);
      if (!isDeepEqual(oldHint, mspHint)) {
        this._trackSidsToRenderHints.set(trackSid, mspHint);
        this._dirtyTrackSids.add(trackSid);
        this._sendHints();
      }
    }

    /**
     * must be called when track is unsubscribed.
     * @param {Track.SID} trackSid
     */

  }, {
    key: 'clearTrackHint',
    value: function clearTrackHint(trackSid) {
      this._trackSidsToRenderHints.delete(trackSid);
      this._dirtyTrackSids.delete(trackSid);
    }
  }]);

  return RenderHintsSignaling;
}(MediaSignaling);

module.exports = RenderHintsSignaling;