'use strict';
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var guessBrowser = require('../webrtc/util').guessBrowser;
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
var PeerConnectionReportFactory = /** @class */ (function () {
    /**
     * Construct a {@link PeerConnectionReportFactory}.
     * @param {RTCPeerConnection} pc
     */
    function PeerConnectionReportFactory(pc) {
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
    PeerConnectionReportFactory.prototype.next = function () {
        var _this = this;
        var updatePromise = guessBrowser() === 'firefox'
            ? updateFirefox(this)
            : updateChrome(this);
        return updatePromise.then(function () {
            var audioSenderReportFactories = __spreadArray([], __read(_this.audio.send.values()));
            var videoSenderReportFactories = __spreadArray([], __read(_this.video.send.values()));
            var audioReceiverReportFactories = __spreadArray([], __read(_this.audio.recv.values()));
            var videoReceiverReportFactories = __spreadArray([], __read(_this.video.recv.values()));
            var report = new PeerConnectionReport(_this.ice.lastReport, {
                send: audioSenderReportFactories.map(function (factory) { return factory.lastReport; }).filter(function (report) { return report; }),
                recv: audioReceiverReportFactories.map(function (factory) { return factory.lastReport; }).filter(function (report) { return report; })
            }, {
                send: videoSenderReportFactories.map(function (factory) { return factory.lastReport; }).filter(function (report) { return report; }),
                recv: videoReceiverReportFactories.map(function (factory) { return factory.lastReport; }).filter(function (report) { return report; })
            });
            _this.lastReport = report;
            return report;
        });
    };
    return PeerConnectionReportFactory;
}());
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
            var e_1, _a;
            try {
                // NOTE(mroberts): We have to rewrite Ids due to this bug:
                //
                //   https://bugzilla.mozilla.org/show_bug.cgi?id=1463430
                //
                for (var _b = __values(report.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var stats = _c.value;
                    if (stats.type === 'inbound-rtp') {
                        stats.id = trackId + "-" + stats.id;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return [trackId, report];
        });
    })).then(function (pairs) { return new Map(pairs); });
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
    var e_2, _a;
    try {
        for (var _b = __values(report.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var stats = _c.value;
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
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
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
    var e_3, _a;
    try {
        for (var _b = __values(report.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var stats = _c.value;
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
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_3) throw e_3.error; }
    }
}
/**
 * @param {SenderReportFactoriesByMediaType|ReceiverReportFactoriesByMediaType} senderOrReceiverReportFactoriesByMediaType
 * @param {StatsIdsByMediaType} senderOrReceiverReportFactoryIdsByMediaType
 * @returns {void}
 */
function deleteSenderOrReceiverReportFactories(senderOrReceiverReportFactoriesByMediaType, senderOrReceiverReportFactoryIdsByMediaType) {
    var _loop_1 = function (mediaType) {
        var senderOrReceiverReportFactories = senderOrReceiverReportFactoriesByMediaType[mediaType];
        var senderOrReceiverReportFactoryIds = senderOrReceiverReportFactoryIdsByMediaType[mediaType];
        senderOrReceiverReportFactoryIds.forEach(function (senderOrReceiverReportFactoryId) { return senderOrReceiverReportFactories.delete(senderOrReceiverReportFactoryId); });
    };
    for (var mediaType in senderOrReceiverReportFactoryIdsByMediaType) {
        _loop_1(mediaType);
    }
}
/**
 * @param {IceReportFactory} ice
 * @param {RTCStatsReport} report
 * @returns {void}
 */
function updateIceReport(ice, report) {
    var e_4, _a, e_5, _b;
    var selectedCandidatePair;
    try {
        for (var _c = __values(report.values()), _d = _c.next(); !_d.done; _d = _c.next()) {
            var stats = _d.value;
            if (stats.type === 'transport') {
                selectedCandidatePair = report.get(stats.selectedCandidatePairId);
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_4) throw e_4.error; }
    }
    if (selectedCandidatePair) {
        ice.next(selectedCandidatePair);
        return;
    }
    try {
        for (var _e = __values(report.values()), _f = _e.next(); !_f.done; _f = _e.next()) {
            var stats = _f.value;
            if (stats.type === 'candidate-pair'
                && stats.nominated
                && ('selected' in stats ? stats.selected : true)) {
                ice.next(stats);
            }
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
        }
        finally { if (e_5) throw e_5.error; }
    }
}
/**
 * @param {PeerConnectionReportFactory} factory
 * @returns {Promise<PeerConnectionReport>}
 */
function updateFirefox(factory) {
    var senders = factory.pc.getTransceivers()
        .filter(function (transceiver) { return transceiver.currentDirection && transceiver.currentDirection.match(/send/) && transceiver.sender.track; })
        .map(function (transceiver) { return transceiver.sender; });
    var receivers = factory.pc.getTransceivers()
        .filter(function (transceiver) { return transceiver.currentDirection && transceiver.currentDirection.match(/recv/); })
        .map(function (transceiver) { return transceiver.receiver; });
    return Promise.all([
        getSenderOrReceiverReports(senders),
        getSenderOrReceiverReports(receivers),
        factory.pc.getStats()
    ]).then(function (_a) {
        var _b = __read(_a, 3), senderReports = _b[0], receiverReports = _b[1], pcReport = _b[2];
        var senderReportFactoriesByMediaType = getSenderReportFactoriesByMediaType(factory);
        var senderReportFactoryIdsToDeleteByMediaType = getSenderReportFactoryIdsByMediaType(factory);
        senderReports.forEach(function (report, trackId) { return updateSenderReports(factory, report, senderReportFactoryIdsToDeleteByMediaType, trackId); });
        deleteSenderOrReceiverReportFactories(senderReportFactoriesByMediaType, senderReportFactoryIdsToDeleteByMediaType);
        var receiverReportFactoriesByMediaType = getReceiverReportFactoriesByMediaType(factory);
        var receiverReportFactoryIdsToDeleteByMediaType = getReceiverReportFactoryIdsByMediaType(factory);
        receiverReports.forEach(function (report, trackId) { return updateReceiverReports(factory, report, receiverReportFactoryIdsToDeleteByMediaType, trackId); });
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
//# sourceMappingURL=peerconnectionreportfactory.js.map