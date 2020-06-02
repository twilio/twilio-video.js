'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require('@twilio/webrtc/lib/util'),
    guessBrowser = _require.guessBrowser;

var IceReportFactory = require('./icereportfactory');
var PeerConnectionReport = require('./peerconnectionreport');
var ReceiverReportFactory = require('./receiverreportfactory');
var SenderReportFactory = require('./senderreportfactory');

/**
 * @typedef {string} TrackId
 */

/**
 * @typedef {string} StatsId
 */

/**
 * @interface SenderReportFactoriesByMediaType
 * @property {Map<StatsId, SenderReportFactory>} audio
 * @property {Map<StatsId, SenderReportFactory>} video
 */

/**
 * @interface ReceiverReportFactoriesByMediaType
 * @property {Map<StatsId, ReceiverReportFactory>} audio
 * @property {Map<StatsId, ReceiverReportFactory>} video
 */

/**
 * @interface SenderAndReceiverReportFactories
 * @property {Map<StatsId, SenderReportFactories>} send
 * @property {Map<StatsId, ReceiverReportFactories>} recv
 */

/**
 * @interface {StatsIdsByMediaType}
 * @property {Set<StatsId>} audio
 * @property {Set<StatsId>} video
 */

/**
 * @property {RTCPeerConnection} pc
 * @property {IceReportFactory} iceReportFactory
 * @property {SenderAndReceiverReportFactories} audio
 * @property {SenderAndReceiverReportFactories} video
 * @property {?PeerConnectionReport} lastReport
 */

var PeerConnectionReportFactory = function () {
  /**
   * Construct a {@link PeerConnectionReportFactory}.
   * @param {RTCPeerConnection} pc
   */
  function PeerConnectionReportFactory(pc) {
    _classCallCheck(this, PeerConnectionReportFactory);

    Object.defineProperties(this, {
      pc: {
        enumerable: true,
        value: pc
      },
      ice: {
        enumerable: true,
        value: new IceReportFactory()
      },
      audio: {
        enumerable: true,
        value: {
          send: new Map(),
          recv: new Map()
        }
      },
      video: {
        enumerable: true,
        value: {
          send: new Map(),
          recv: new Map()
        }
      },
      lastReport: {
        enumerable: true,
        value: null,
        writable: true
      }
    });
  }

  /**
   * Create a {@link PeerConnectionReport}.
   * @returns {Promise<PeerConnectionReport>}
   */


  _createClass(PeerConnectionReportFactory, [{
    key: 'next',
    value: function next() {
      var _this = this;

      var updatePromise = guessBrowser() === 'firefox' ? updateFirefox(this) : updateChrome(this);

      return updatePromise.then(function () {
        var audioSenderReportFactories = [].concat(_toConsumableArray(_this.audio.send.values()));
        var videoSenderReportFactories = [].concat(_toConsumableArray(_this.video.send.values()));
        var audioReceiverReportFactories = [].concat(_toConsumableArray(_this.audio.recv.values()));
        var videoReceiverReportFactories = [].concat(_toConsumableArray(_this.video.recv.values()));

        var report = new PeerConnectionReport(_this.ice.lastReport, {
          send: audioSenderReportFactories.map(function (factory) {
            return factory.lastReport;
          }).filter(function (report) {
            return report;
          }),
          recv: audioReceiverReportFactories.map(function (factory) {
            return factory.lastReport;
          }).filter(function (report) {
            return report;
          })
        }, {
          send: videoSenderReportFactories.map(function (factory) {
            return factory.lastReport;
          }).filter(function (report) {
            return report;
          }),
          recv: videoReceiverReportFactories.map(function (factory) {
            return factory.lastReport;
          }).filter(function (report) {
            return report;
          })
        });

        _this.lastReport = report;

        return report;
      });
    }
  }]);

  return PeerConnectionReportFactory;
}();

/**
 * Construct a Map from MediaStreamTrack Ids to RTCStatsReports.
 * @param {Array<RTCRtpSender>|Array<RTCRtpReceiver>} sendersOrReceivers - each
 *   RTCRtpSender should have a non-null track
 * @returns {Promise<Map<TrackId, RTCStats>>}
 */


function getSenderOrReceiverReports(sendersOrReceivers) {
  return Promise.all(sendersOrReceivers.map(function (senderOrReceiver) {
    var trackId = senderOrReceiver.track.id;
    return senderOrReceiver.getStats().then(function (report) {
      // NOTE(mroberts): We have to rewrite Ids due to this bug:
      //
      //   https://bugzilla.mozilla.org/show_bug.cgi?id=1463430
      //
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = report.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var stats = _step.value;

          if (stats.type === 'inbound-rtp') {
            stats.id = trackId + '-' + stats.id;
          }
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return [trackId, report];
    });
  })).then(function (pairs) {
    return new Map(pairs);
  });
}

/**
 * @param {SenderReportFactory.constructor} SenderReportFactory
 * @param {SenderReportFactoriesByMediaType} sendersByMediaType
 * @param {RTCStatsReport} report
 * @param {RTCStats} stats
 * @param {TrackId} [trackId]
 * @returns {?SenderReportFactory}
 */ /**
    * @param {ReceiverReportFactory.constructor} ReceiverReportFactory
    * @param {ReceiverReportFactoriesByMediaType} receiversByMediaType
    * @param {RTCStatsReport} report
    * @param {RTCStats} stats
    * @param {TrackId} [trackId]
    * @returns {?ReceiverReportFactory}
    */
function getOrCreateSenderOrReceiverReportFactory(SenderOrReceiverReportFactory, sendersOrReceiversByMediaType, report, stats, trackId) {
  var sendersOrReceivers = sendersOrReceiversByMediaType[stats.mediaType];
  if (!trackId) {
    var trackStats = report.get(stats.trackId);
    if (trackStats) {
      trackId = trackStats.trackIdentifier;
    }
  }
  if (sendersOrReceivers && trackId) {
    if (sendersOrReceivers.has(stats.id)) {
      return sendersOrReceivers.get(stats.id);
    }
    var senderOrReceiverFactory = new SenderOrReceiverReportFactory(trackId, stats);
    sendersOrReceivers.set(stats.id, senderOrReceiverFactory);
  }
  return null;
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @returns {SenderReportFactoriesByMediaType}
 */
function getSenderReportFactoriesByMediaType(factory) {
  return { audio: factory.audio.send, video: factory.video.send };
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @returns {ReceiverReportFactoriesByMediaType}
 */
function getReceiverReportFactoriesByMediaType(factory) {
  return { audio: factory.audio.recv, video: factory.video.recv };
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @param {RTCStatsReport} report
 * @param {RTCStats} stats
 * @param {TrackId} [trackId]
 * @returns {?SenderReportFactory}
 */
function getOrCreateSenderReportFactory(factory, report, stats, trackId) {
  return getOrCreateSenderOrReceiverReportFactory(SenderReportFactory, getSenderReportFactoriesByMediaType(factory), report, stats, trackId);
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @param {RTCStatsReport} report
 * @param {RTCStats} stats
 * @param {TrackId} [trackId]
 * @returns {?ReceiverReportFactory}
 */
function getOrCreateReceiverReportFactory(factory, report, stats, trackId) {
  return getOrCreateSenderOrReceiverReportFactory(ReceiverReportFactory, getReceiverReportFactoriesByMediaType(factory), report, stats, trackId);
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @retuns {StatsIdsByMediaType}
 */
function getSenderReportFactoryIdsByMediaType(factory) {
  return {
    audio: new Set(factory.audio.send.keys()),
    video: new Set(factory.video.send.keys())
  };
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @retuns {StatsIdsByMediaType}
 */
function getReceiverReportFactoryIdsByMediaType(factory) {
  return {
    audio: new Set(factory.audio.recv.keys()),
    video: new Set(factory.video.recv.keys())
  };
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @param {RTCStatsReport} report
 * @param {StatsIdsByMediaType} senderReportFactoryIdsToDeleteByMediaType
 * @param {TrackId} [trackId]
 * @returns {void}
 */
function updateSenderReports(factory, report, senderReportFactoryIdsToDeleteByMediaType, trackId) {
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = report.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var stats = _step2.value;

      if (stats.type === 'outbound-rtp' && !stats.isRemote) {
        if (guessBrowser() !== 'firefox' && !stats.trackId) {
          continue;
        }
        var senderReportFactoryIdsToDelete = senderReportFactoryIdsToDeleteByMediaType[stats.mediaType];
        if (senderReportFactoryIdsToDelete) {
          senderReportFactoryIdsToDelete.delete(stats.id);
        }
        var senderReportFactory = getOrCreateSenderReportFactory(factory, report, stats, trackId);
        if (senderReportFactory) {
          var remoteInboundStats = report.get(stats.remoteId);
          senderReportFactory.next(trackId || senderReportFactory.trackId, stats, remoteInboundStats);
        }
      }
    }
  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @param {RTCStatsReport} report
 * @param {StatsIdsByMediaType} receiverReportFactoryIdsToDeleteByMediaType
 * @param {TrackId} [trackId]
 * @returns {void}
 */
function updateReceiverReports(factory, report, receiverReportFactoryIdsToDeleteByMediaType, trackId) {
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = report.values()[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var stats = _step3.value;

      if (stats.type === 'inbound-rtp' && !stats.isRemote) {
        var receiverReportFactoryIdsToDelete = receiverReportFactoryIdsToDeleteByMediaType[stats.mediaType];
        if (receiverReportFactoryIdsToDelete) {
          receiverReportFactoryIdsToDelete.delete(stats.id);
        }
        var receiverReportFactory = getOrCreateReceiverReportFactory(factory, report, stats, trackId);
        if (receiverReportFactory) {
          receiverReportFactory.next(trackId || receiverReportFactory.trackId, stats);
        }
      }
    }
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3.return) {
        _iterator3.return();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }
}

/**
 * @param {SenderReportFactoriesByMediaType|ReceiverReportFactoriesByMediaType} senderOrReceiverReportFactoriesByMediaType
 * @param {StatsIdsByMediaType} senderOrReceiverReportFactoryIdsByMediaType
 * @returns {void}
 */
function deleteSenderOrReceiverReportFactories(senderOrReceiverReportFactoriesByMediaType, senderOrReceiverReportFactoryIdsByMediaType) {
  var _loop = function _loop(mediaType) {
    var senderOrReceiverReportFactories = senderOrReceiverReportFactoriesByMediaType[mediaType];
    var senderOrReceiverReportFactoryIds = senderOrReceiverReportFactoryIdsByMediaType[mediaType];
    senderOrReceiverReportFactoryIds.forEach(function (senderOrReceiverReportFactoryId) {
      return senderOrReceiverReportFactories.delete(senderOrReceiverReportFactoryId);
    });
  };

  for (var mediaType in senderOrReceiverReportFactoryIdsByMediaType) {
    _loop(mediaType);
  }
}

/**
 * @param {IceReportFactory} ice
 * @param {RTCStatsReport} report
 * @returns {void}
 */
function updateIceReport(ice, report) {
  var selectedCandidatePair = void 0;
  var _iteratorNormalCompletion4 = true;
  var _didIteratorError4 = false;
  var _iteratorError4 = undefined;

  try {
    for (var _iterator4 = report.values()[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
      var stats = _step4.value;

      if (stats.type === 'transport') {
        selectedCandidatePair = report.get(stats.selectedCandidatePairId);
      }
    }
  } catch (err) {
    _didIteratorError4 = true;
    _iteratorError4 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion4 && _iterator4.return) {
        _iterator4.return();
      }
    } finally {
      if (_didIteratorError4) {
        throw _iteratorError4;
      }
    }
  }

  if (selectedCandidatePair) {
    ice.next(selectedCandidatePair);
    return;
  }
  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (var _iterator5 = report.values()[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
      var _stats = _step5.value;

      if (_stats.type === 'candidate-pair' && _stats.nominated && ('selected' in _stats ? _stats.selected : true)) {
        ice.next(_stats);
      }
    }
  } catch (err) {
    _didIteratorError5 = true;
    _iteratorError5 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion5 && _iterator5.return) {
        _iterator5.return();
      }
    } finally {
      if (_didIteratorError5) {
        throw _iteratorError5;
      }
    }
  }
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @returns {Promise<PeerConnectionReport>}
 */
function updateFirefox(factory) {
  var senders = factory.pc.getTransceivers().filter(function (transceiver) {
    return transceiver.currentDirection && transceiver.currentDirection.match(/send/) && transceiver.sender.track;
  }).map(function (transceiver) {
    return transceiver.sender;
  });

  var receivers = factory.pc.getTransceivers().filter(function (transceiver) {
    return transceiver.currentDirection && transceiver.currentDirection.match(/recv/);
  }).map(function (transceiver) {
    return transceiver.receiver;
  });

  return Promise.all([getSenderOrReceiverReports(senders), getSenderOrReceiverReports(receivers), factory.pc.getStats()]).then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 3),
        senderReports = _ref2[0],
        receiverReports = _ref2[1],
        pcReport = _ref2[2];

    var senderReportFactoriesByMediaType = getSenderReportFactoriesByMediaType(factory);
    var senderReportFactoryIdsToDeleteByMediaType = getSenderReportFactoryIdsByMediaType(factory);
    senderReports.forEach(function (report, trackId) {
      return updateSenderReports(factory, report, senderReportFactoryIdsToDeleteByMediaType, trackId);
    });
    deleteSenderOrReceiverReportFactories(senderReportFactoriesByMediaType, senderReportFactoryIdsToDeleteByMediaType);

    var receiverReportFactoriesByMediaType = getReceiverReportFactoriesByMediaType(factory);
    var receiverReportFactoryIdsToDeleteByMediaType = getReceiverReportFactoryIdsByMediaType(factory);
    receiverReports.forEach(function (report, trackId) {
      return updateReceiverReports(factory, report, receiverReportFactoryIdsToDeleteByMediaType, trackId);
    });
    deleteSenderOrReceiverReportFactories(receiverReportFactoriesByMediaType, receiverReportFactoryIdsToDeleteByMediaType);

    updateIceReport(factory.ice, pcReport);
  });
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @returns {Promise<PeerConnectionReport>}
 */
function updateChrome(factory) {
  return factory.pc.getStats().then(function (report) {
    var senderReportFactoriesByMediaType = getSenderReportFactoriesByMediaType(factory);
    var senderReportFactoryIdsToDeleteByMediaType = getSenderReportFactoryIdsByMediaType(factory);
    updateSenderReports(factory, report, senderReportFactoryIdsToDeleteByMediaType);
    deleteSenderOrReceiverReportFactories(senderReportFactoriesByMediaType, senderReportFactoryIdsToDeleteByMediaType);

    var receiverReportFactoriesByMediaType = getReceiverReportFactoriesByMediaType(factory);
    var receiverReportFactoryIdsToDeleteByMediaType = getReceiverReportFactoryIdsByMediaType(factory);
    updateReceiverReports(factory, report, receiverReportFactoryIdsToDeleteByMediaType);
    deleteSenderOrReceiverReportFactories(receiverReportFactoriesByMediaType, receiverReportFactoryIdsToDeleteByMediaType);

    updateIceReport(factory.ice, report);
  });
}

module.exports = PeerConnectionReportFactory;