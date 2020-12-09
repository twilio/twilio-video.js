/* eslint-disable no-console */
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

var VALID_GROUPS = ['signaling', 'room'];

var VALID_LEVELS = ['debug', 'error', 'info', 'warning'];

/**
 * EventObserver listens to SDK events and re-emits them on the
 * @link EventListener} with some additional information.
 * @extends EventEmitter
 * @emits EventObserver#event
 */

var EventObserver = function (_EventEmitter) {
  _inherits(EventObserver, _EventEmitter);

  /**
   * Constructor.
   * @param {number} connectTimestamp
   * @param {log} Log
   * @param {EventListener} eventListener
   */
  function EventObserver(connectTimestamp, log) {
    var eventListener = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    _classCallCheck(this, EventObserver);

    var _this = _possibleConstructorReturn(this, (EventObserver.__proto__ || Object.getPrototypeOf(EventObserver)).call(this));

    Object.defineProperties(_this, {
      _publisher: {
        value: null,
        writable: true
      }
    });

    _this.on('event', function (_ref) {
      var name = _ref.name,
          group = _ref.group,
          level = _ref.level,
          payload = _ref.payload;

      if (typeof name !== 'string') {
        throw new Error('Unexpected name: ', name);
      }

      if (!VALID_GROUPS.includes(group)) {
        throw new Error('Unexpected group: ', group);
      }

      if (!VALID_LEVELS.includes(level)) {
        throw new Error('Unexpected level: ', level);
      }

      var timestamp = Date.now();
      var elapsedTime = timestamp - connectTimestamp;

      if (_this._publisher) {
        var publisherPayload = Object.assign(payload ? payload : {}, { elapsedTime: elapsedTime, level: level });
        _this._publisher.publish(group, name, publisherPayload);
      }
      var event = Object.assign(payload ? { payload: payload } : {}, {
        elapsedTime: elapsedTime,
        group: group,
        level: level,
        name: name,
        timestamp: timestamp
      });

      var logLevel = {
        debug: 'debug',
        error: 'error',
        info: 'info',
        warning: 'warn'
      }[level];
      log[logLevel]('event', event);

      if (eventListener && group === 'signaling') {
        var _event = Object.assign(payload ? { payload: payload } : {}, {
          elapsedTime: elapsedTime,
          group: group,
          level: level,
          name: name,
          timestamp: timestamp
        });
        eventListener.emit('event', _event);
      }
    });
    return _this;
  }

  /**
   * sets the publisher object. Once set events will be send to publisher.
   * @param {InsightsPublisher} publisher
  */


  _createClass(EventObserver, [{
    key: 'setPublisher',
    value: function setPublisher(publisher) {
      this._publisher = publisher;
    }
  }]);

  return EventObserver;
}(EventEmitter);

/**
 * An SDK event.
 * @event EventObserver#event
 * @param {{name: string, payload: *}} event
 */

module.exports = EventObserver;