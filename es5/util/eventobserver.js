'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

var _require2 = require('../twilioconnection'),
    LOCAL = _require2.CloseReason.LOCAL;

var GROUPS = {
  SIGNALING: 'signaling'
};

var LEVELS = {
  DEBUG: 'debug',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

var eventNamesToGroups = {
  closed: GROUPS.SIGNALING,
  connecting: GROUPS.SIGNALING,
  early: GROUPS.SIGNALING,
  open: GROUPS.SIGNALING,
  waiting: GROUPS.SIGNALING
};

var eventNamesToLevels = {
  closed: function closed(payload) {
    return payload.reason === LOCAL ? LEVELS.INFO : LEVELS.ERROR;
  },

  connecting: LEVELS.INFO,
  early: LEVELS.INFO,
  open: LEVELS.INFO,
  waiting: LEVELS.WARNING
};

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
   * @param {EventListener} eventListener
   */
  function EventObserver(connectTimestamp) {
    var eventListener = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    _classCallCheck(this, EventObserver);

    var _this = _possibleConstructorReturn(this, (EventObserver.__proto__ || Object.getPrototypeOf(EventObserver)).call(this));

    if (eventListener) {
      _this.on('event', function (_ref) {
        var name = _ref.name,
            payload = _ref.payload;

        var timestamp = Date.now();
        var elapsedTime = timestamp - connectTimestamp;
        var group = eventNamesToGroups[name];

        var level = typeof eventNamesToLevels[name] === 'function' ? eventNamesToLevels[name](payload) : eventNamesToLevels[name];

        var event = Object.assign(payload ? { payload: payload } : {}, {
          elapsedTime: elapsedTime,
          group: group,
          level: level,
          name: name,
          timestamp: timestamp
        });

        eventListener.emit('event', event);
      });
    }
    return _this;
  }

  return EventObserver;
}(EventEmitter);

/**
 * An SDK event.
 * @event EventObserver#event
 * @param {{name: string, payload: *}} event
 */

module.exports = EventObserver;