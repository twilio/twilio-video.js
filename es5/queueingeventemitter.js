'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;

/**
 * A {@link QueueingEventEmitter} can queue events until a listener has been
 * added.
 * @extends EventEmitter
 */

var QueueingEventEmitter = function (_EventEmitter) {
  _inherits(QueueingEventEmitter, _EventEmitter);

  /**
   * Construct a {@link QueueingEventEmitter}
   */
  function QueueingEventEmitter() {
    _classCallCheck(this, QueueingEventEmitter);

    var _this = _possibleConstructorReturn(this, (QueueingEventEmitter.__proto__ || Object.getPrototypeOf(QueueingEventEmitter)).call(this));

    Object.defineProperties(_this, {
      _queuedEvents: {
        value: new Map()
      }
    });
    return _this;
  }

  /**
   * Emit any queued events.
   * @returns {boolean} true if every event had listeners, false otherwise
  */ /**
     * Emit any queued events matching the event name.
     * @param {string} event
     * @returns {boolean} true if every event had listeners, false otherwise
     */


  _createClass(QueueingEventEmitter, [{
    key: 'dequeue',
    value: function dequeue(event) {
      var _this2 = this;

      var result = true;
      if (!event) {
        this._queuedEvents.forEach(function (_, queuedEvent) {
          result = this.dequeue(queuedEvent) && result;
        }, this);
        return result;
      }
      var queue = this._queuedEvents.get(event) || [];
      this._queuedEvents.delete(event);
      return queue.reduce(function (result, args) {
        return _this2.emit.apply(_this2, _toConsumableArray([event].concat(args))) && result;
      }, result);
    }

    /**
     * If the event has listeners, emit the event; otherwise, queue the event.
     * @param {string} event
     * @param {...*} args
     * @returns {boolean} true if the event had listeners, false if the event was queued
     */

  }, {
    key: 'queue',
    value: function queue() {
      var args = [].slice.call(arguments);
      if (this.emit.apply(this, _toConsumableArray(args))) {
        return true;
      }
      var event = args[0];
      if (!this._queuedEvents.has(event)) {
        this._queuedEvents.set(event, []);
      }
      this._queuedEvents.get(event).push(args.slice(1));
      return false;
    }
  }]);

  return QueueingEventEmitter;
}(EventEmitter);

module.exports = QueueingEventEmitter;