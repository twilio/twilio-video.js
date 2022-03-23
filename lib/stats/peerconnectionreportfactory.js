'use strict';

const { guessBrowser } = require('../webrtc/util');

const IceReportFactory = require('./icereportfactory');
const PeerConnectionReport = require('./peerconnectionreport');
const ReceiverReportFactory = require('./receiverreportfactory');
const SenderReportFactory = require('./senderreportfactory');

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
class PeerConnectionReportFactory {
  /**
   * Construct a {@link PeerConnectionReportFactory}.
   * @param {RTCPeerConnection} pc
   */
  constructor(pc) {
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
  next() {
    const updatePromise = guessBrowser() === 'firefox'
      ? updateFirefox(this)
      : updateChrome(this);

    return updatePromise.then(() => {
      const audioSenderReportFactories = [...this.audio.send.values()];
      const videoSenderReportFactories = [...this.video.send.values()];
      const audioReceiverReportFactories = [...this.audio.recv.values()];
      const videoReceiverReportFactories = [...this.video.recv.values()];

      const report = new PeerConnectionReport(
        this.ice.lastReport,
        {
          send: audioSenderReportFactories.map(factory => factory.lastReport).filter(report => report),
          recv: audioReceiverReportFactories.map(factory => factory.lastReport).filter(report => report)
        },
        {
          send: videoSenderReportFactories.map(factory => factory.lastReport).filter(report => report),
          recv: videoReceiverReportFactories.map(factory => factory.lastReport).filter(report => report)
        }
      );

      this.lastReport = report;

      return report;
    });
  }
}

/**
 * Construct a Map from MediaStreamTrack Ids to RTCStatsReports.
 * @param {Array<RTCRtpSender>|Array<RTCRtpReceiver>} sendersOrReceivers - each
 *   RTCRtpSender should have a non-null track
 * @returns {Promise<Map<TrackId, RTCStats>>}
 */
function getSenderOrReceiverReports(sendersOrReceivers) {
  return Promise.all(sendersOrReceivers.map(senderOrReceiver => {
    const trackId = senderOrReceiver.track.id;
    return senderOrReceiver.getStats().then(report => {
      // NOTE(mroberts): We have to rewrite Ids due to this bug:
      //
      //   https://bugzilla.mozilla.org/show_bug.cgi?id=1463430
      //
      for (const stats of report.values()) {
        if (stats.type === 'inbound-rtp') {
          stats.id = `${trackId}-${stats.id}`;
        }
      }
      return [trackId, report];
    });
  })).then(pairs => new Map(pairs));
}

/**
 * @param {SenderReportFactory.constructor} SenderReportFactory
 * @param {SenderReportFactoriesByMediaType} sendersByMediaType
 * @param {RTCStatsReport} report
 * @param {RTCStats} stats
 * @param {TrackId} [trackId]
 * @returns {?SenderReportFactory}
 *//**
 * @param {ReceiverReportFactory.constructor} ReceiverReportFactory
 * @param {ReceiverReportFactoriesByMediaType} receiversByMediaType
 * @param {RTCStatsReport} report
 * @param {RTCStats} stats
 * @param {TrackId} [trackId]
 * @returns {?ReceiverReportFactory}
 */
function getOrCreateSenderOrReceiverReportFactory(SenderOrReceiverReportFactory, sendersOrReceiversByMediaType, report, stats, trackId) {
  const sendersOrReceivers = sendersOrReceiversByMediaType[stats.mediaType];
  if (!trackId) {
    const trackStats = report.get(stats.trackId);
    if (trackStats) {
      trackId = trackStats.trackIdentifier;
    }
  }
  if (sendersOrReceivers && trackId) {
    if (sendersOrReceivers.has(stats.id)) {
      return sendersOrReceivers.get(stats.id);
    }
    const senderOrReceiverFactory = new SenderOrReceiverReportFactory(trackId, stats);
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
  for (const stats of report.values()) {
    if (stats.type === 'outbound-rtp' && !stats.isRemote) {
      if (guessBrowser() !== 'firefox' && !stats.trackId) {
        continue;
      }
      const senderReportFactoryIdsToDelete = senderReportFactoryIdsToDeleteByMediaType[stats.mediaType];
      if (senderReportFactoryIdsToDelete) {
        senderReportFactoryIdsToDelete.delete(stats.id);
      }
      const senderReportFactory = getOrCreateSenderReportFactory(factory, report, stats, trackId);
      if (senderReportFactory) {
        const remoteInboundStats = report.get(stats.remoteId);
        senderReportFactory.next(trackId || senderReportFactory.trackId, stats, remoteInboundStats);
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
  for (const stats of report.values()) {
    if (stats.type === 'inbound-rtp' && !stats.isRemote) {
      const receiverReportFactoryIdsToDelete = receiverReportFactoryIdsToDeleteByMediaType[stats.mediaType];
      if (receiverReportFactoryIdsToDelete) {
        receiverReportFactoryIdsToDelete.delete(stats.id);
      }
      const receiverReportFactory = getOrCreateReceiverReportFactory(factory, report, stats, trackId);
      if (receiverReportFactory) {
        receiverReportFactory.next(trackId || receiverReportFactory.trackId, stats);
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
  for (const mediaType in senderOrReceiverReportFactoryIdsByMediaType) {
    const senderOrReceiverReportFactories = senderOrReceiverReportFactoriesByMediaType[mediaType];
    const senderOrReceiverReportFactoryIds = senderOrReceiverReportFactoryIdsByMediaType[mediaType];
    senderOrReceiverReportFactoryIds.forEach(senderOrReceiverReportFactoryId => senderOrReceiverReportFactories.delete(senderOrReceiverReportFactoryId));
  }
}

/**
 * @param {IceReportFactory} ice
 * @param {RTCStatsReport} report
 * @returns {void}
 */
function updateIceReport(ice, report) {
  let selectedCandidatePair;
  for (const stats of report.values()) {
    if (stats.type === 'transport') {
      selectedCandidatePair = report.get(stats.selectedCandidatePairId);
    }
  }
  if (selectedCandidatePair) {
    ice.next(selectedCandidatePair);
    return;
  }
  for (const stats of report.values()) {
    if (stats.type === 'candidate-pair'
      && stats.nominated
      && ('selected' in stats ? stats.selected : true)) {
      ice.next(stats);
    }
  }
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @returns {Promise<PeerConnectionReport>}
 */
function updateFirefox(factory) {
  const senders = factory.pc.getTransceivers()
    .filter(transceiver => transceiver.currentDirection && transceiver.currentDirection.match(/send/) && transceiver.sender.track)
    .map(transceiver => transceiver.sender);

  const receivers = factory.pc.getTransceivers()
    .filter(transceiver => transceiver.currentDirection && transceiver.currentDirection.match(/recv/))
    .map(transceiver => transceiver.receiver);

  return Promise.all([
    getSenderOrReceiverReports(senders),
    getSenderOrReceiverReports(receivers),
    factory.pc.getStats()
  ]).then(([senderReports, receiverReports, pcReport]) => {
    const senderReportFactoriesByMediaType = getSenderReportFactoriesByMediaType(factory);
    const senderReportFactoryIdsToDeleteByMediaType = getSenderReportFactoryIdsByMediaType(factory);
    senderReports.forEach((report, trackId) => updateSenderReports(factory, report, senderReportFactoryIdsToDeleteByMediaType, trackId));
    deleteSenderOrReceiverReportFactories(senderReportFactoriesByMediaType, senderReportFactoryIdsToDeleteByMediaType);

    const receiverReportFactoriesByMediaType = getReceiverReportFactoriesByMediaType(factory);
    const receiverReportFactoryIdsToDeleteByMediaType = getReceiverReportFactoryIdsByMediaType(factory);
    receiverReports.forEach((report, trackId) => updateReceiverReports(factory, report, receiverReportFactoryIdsToDeleteByMediaType, trackId));
    deleteSenderOrReceiverReportFactories(receiverReportFactoriesByMediaType, receiverReportFactoryIdsToDeleteByMediaType);

    updateIceReport(factory.ice, pcReport);
  });
}

/**
 * @param {PeerConnectionReportFactory} factory
 * @returns {Promise<PeerConnectionReport>}
 */
function updateChrome(factory) {
  return factory.pc.getStats().then(report => {
    const senderReportFactoriesByMediaType = getSenderReportFactoriesByMediaType(factory);
    const senderReportFactoryIdsToDeleteByMediaType = getSenderReportFactoryIdsByMediaType(factory);
    updateSenderReports(factory, report, senderReportFactoryIdsToDeleteByMediaType);
    deleteSenderOrReceiverReportFactories(senderReportFactoriesByMediaType, senderReportFactoryIdsToDeleteByMediaType);

    const receiverReportFactoriesByMediaType = getReceiverReportFactoriesByMediaType(factory);
    const receiverReportFactoryIdsToDeleteByMediaType = getReceiverReportFactoryIdsByMediaType(factory);
    updateReceiverReports(factory, report, receiverReportFactoryIdsToDeleteByMediaType);
    deleteSenderOrReceiverReportFactories(receiverReportFactoriesByMediaType, receiverReportFactoryIdsToDeleteByMediaType);

    updateIceReport(factory.ice, report);
  });
}

module.exports = PeerConnectionReportFactory;
