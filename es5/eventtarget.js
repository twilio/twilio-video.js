'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

var EventTarget = function () {
  function EventTarget() {
    _classCallCheck(this, EventTarget);

    Object.defineProperties(this, {
      _eventEmitter: {
        value: new EventEmitter()
      }
    });
  }

  _createClass(EventTarget, [{
    key: 'dispatchEvent',
    value: function dispatchEvent(event) {
      return this._eventEmitter.emit(event.type, event);
    }
  }, {
    key: 'addEventListener',
    value: function addEventListener() {
      var _eventEmitter;

      return (_eventEmitter = this._eventEmitter).addListener.apply(_eventEmitter, arguments);
    }
  }, {
    key: 'removeEventListener',
    value: function removeEventListener() {
      var _eventEmitter2;

      return (_eventEmitter2 = this._eventEmitter).removeListener.apply(_eventEmitter2, arguments);
    }
  }]);

  return EventTarget;
}();

module.exports = EventTarget;