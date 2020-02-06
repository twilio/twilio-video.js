/* eslint callback-return:0 */
'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events');

var PeerConnectionReportFactory = require('../../stats/peerconnectionreportfactory');

/**
 * @emits NetworkQualityMonitor#updated
 */

var NetworkQualityMonitor = function (_EventEmitter) {
  _inherits(NetworkQualityMonitor, _EventEmitter);

  /**
   * Construct a {@link NetworkQualityMonitor}.
   * @param {PeerConnectionManager} manager
   * @param {NetworkQualitySignaling} signaling
   */
  function NetworkQualityMonitor(manager, signaling) {
    _classCallCheck(this, NetworkQualityMonitor);

    var _this = _possibleConstructorReturn(this, (NetworkQualityMonitor.__proto__ || Object.getPrototypeOf(NetworkQualityMonitor)).call(this));

    Object.defineProperties(_this, {
      _factories: {
        value: new WeakMap()
      },
      _manager: {
        value: manager
      },
      _signaling: {
        value: signaling
      }
    });
    signaling.on('updated', function () {
      return _this.emit('updated');
    });
    return _this;
  }

  /**
   * Get the current {@link NetworkQualityLevel}, if any.
   * @returns {?NetworkQualityLevel} level - initially null
   */


  _createClass(NetworkQualityMonitor, [{
    key: 'start',


    /**
     * Start monitoring.
     * @returns {void}
     */
    value: function start() {
      var _this2 = this;

      this.stop();
      var timeout = setTimeout(function () {
        if (_this2._timeout !== timeout) {
          return;
        }
        next(_this2).then(function (reports) {
          if (_this2._timeout !== timeout) {
            return;
          }
          if (reports.length) {
            var _reports = _slicedToArray(reports, 1),
                report = _reports[0];

            _this2._signaling.put(report);
          }
          _this2.start();
        });
      }, 200);
      this._timeout = timeout;
    }

    /**
     * Stop monitoring.
     * @returns {void}
     */

  }, {
    key: 'stop',
    value: function stop() {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
  }, {
    key: 'level',
    get: function get() {
      return this._signaling.level;
    }

    /**
     * Get the current {@link NetworkQualityLevels}, if any.
     * @returns {?NetworkQualityLevels} levels - initially null
     */

  }, {
    key: 'levels',
    get: function get() {
      return this._signaling.levels;
    }

    /**
     * Get the current {@link NetworkQualityLevels} of remote participants, if any.
     * @returns {Map<String, NetworkQualityLevels>} remoteLevels
     */

  }, {
    key: 'remoteLevels',
    get: function get() {
      return this._signaling.remoteLevels;
    }
  }]);

  return NetworkQualityMonitor;
}(EventEmitter);

/**
 * @param {NetworkQualityMonitor}
 * @returns {Promise<NetworkQualityInputs>}
 */


function next(monitor) {
  var pcv2s = monitor._manager._peerConnections ? Array.from(monitor._manager._peerConnections.values()) : [];

  var pcs = pcv2s.map(function (pcv2) {
    return pcv2._peerConnection;
  }).filter(function (pc) {
    return pc.signalingState !== 'closed';
  });

  var factories = pcs.map(function (pc) {
    if (monitor._factories.has(pc)) {
      return monitor._factories.get(pc);
    }
    var factory = new PeerConnectionReportFactory(pc);
    monitor._factories.set(pc, factory);
    return factory;
  });

  var reportsOrNullPromises = factories.map(function (factory) {
    return factory.next().catch(function () {
      return null;
    });
  });

  return Promise.all(reportsOrNullPromises).then(function (reportsOrNull) {
    return reportsOrNull.filter(function (reportOrNull) {
      return reportOrNull;
    }).map(function (report) {
      return report.summarize();
    });
  });
}

/**
 * The {@link NetworkQualityLevel} changed.
 * @event NetworkQualityMonitor#updated
 */

module.exports = NetworkQualityMonitor;