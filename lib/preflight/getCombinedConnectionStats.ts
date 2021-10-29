/* eslint-disable @typescript-eslint/no-explicit-any */
import { RTCIceCandidateStats, SelectedIceCandidatePairStats,  } from '../../tsdef/PreflightTypes';
import type { RTCIceCandidatePairStats } from './rtctypes';

interface RTCStatsReport {
  [x: string]: any;
  forEach(callbackfn: (value: any, key: string, parent: RTCStatsReport) => void, thisArg?: any): void;
}
export interface CombinedConnectionStats {
  timestamp: number;
  bytesSent: number;
  bytesReceived: number;
  packets: number;
  packetsLost: number;
  roundTripTime: number;
  jitter: number;
  selectedIceCandidatePairStats: SelectedIceCandidatePairStats | null;
  iceCandidateStats: RTCIceCandidateStats[];
}

function getStatValues(report: RTCStatsReport, statName: string, kind: string[], reportTypes: string[]): number[] {
  let results: number[] = [];
  report.forEach(stat => {
    if (
      (reportTypes.length === 0 || reportTypes.includes(stat.type)) &&
      (kind.length === 0 || kind.includes(stat.kind)) &&
      typeof stat[statName] === 'number') {
      results.push(stat[statName]);
    }
  });
  return results;
}

export async function getCombinedConnectionStats({ publisher, subscriber }: { publisher: RTCPeerConnection, subscriber: RTCPeerConnection }): Promise<CombinedConnectionStats> {
  const [publisherStats, subscriberStats] = await Promise.all([publisher, subscriber].map(pc => pc.getStats()));

  const timestamps = getStatValues(subscriberStats, 'timestamp', ['audio'], ['inbound-rtp']);
  const timestamp = timestamps.length > 0 ? timestamps[0] : 0;

  // jitter: subscriber, inbound-rtp, audio
  //         Note: chrome has jitter for video, but not Safari.
  //         Note: also jitter values are in seconds, but chrome's video jitter values were found to be are too big to be in seconds.
  const jitter = getStatValues(subscriberStats, 'jitter', ['audio'], ['inbound-rtp']).reduce((a, b) => Math.max(a, b), 0);

  // packets, packetsLost:
  //              subscriber, audio, inbound-rtp,
  //              subscriber, video, inbound-rtp
  const packets = getStatValues(subscriberStats, 'packetsReceived', ['audio', 'video'], ['inbound-rtp']).reduce((a, b) => a + b, 0);
  const packetsLost = getStatValues(subscriberStats, 'packetsLost', ['audio', 'video'], ['inbound-rtp']).reduce((a, b) => a + b, 0);

  // roundTripTime: publisher, audio, remote-inbound-rtp
  //                publisher, video, remote-inbound-rtp
  const trackRoundTripTime = getStatValues(publisherStats, 'roundTripTime', ['audio', 'video'], ['remote-inbound-rtp']).reduce((a, b) => Math.max(a, b), 0);

  // currentRoundTripTime. subscriber, 'candidate-pair'
  const currentRoundTripTime = getStatValues(subscriberStats, 'currentRoundTripTime', [], ['candidate-pair']).reduce((a, b) => Math.max(a, b), 0);
  const roundTripTime = (currentRoundTripTime || trackRoundTripTime) * 1000;

  const bytesSent = getStatValues(publisherStats, 'bytesSent', [], ['candidate-pair']).reduce((a, b) => a + b, 0);
  const bytesReceived = getStatValues(subscriberStats, 'bytesReceived', [], ['candidate-pair']).reduce((a, b) => a + b, 0);

  const selectedIceCandidatePairStats = extractSelectedActiveCandidatePair(subscriberStats);

  const iceCandidateStats: RTCIceCandidateStats[] = [];
  subscriberStats.forEach(stat => {
    if (stat.type === 'local-candidate' || stat.type === 'remote-candidate') {
      iceCandidateStats.push(makeStandardCandidateStats(stat));
    }
  });
  return { timestamp, jitter, packets, packetsLost, roundTripTime, bytesSent, bytesReceived, selectedIceCandidatePairStats, iceCandidateStats };
}


function makeStandardCandidateStats(input: any) : RTCIceCandidateStats {
  const standardizedCandidateStatsKeys = [
    { key: 'transportId', type: 'string' },
    { key: 'candidateType', type: 'string' },
    { key: 'port', altKeys: ['portNumber'], type: 'number' },
    { key: 'address', altKeys: ['ip', 'ipAddress'], type: 'string' },
    { key: 'priority', type: 'number' },
    { key: 'protocol', altKeys: ['transport'], type: 'string' },
    { key: 'url', type: 'string' },
    { key: 'relayProtocol', type: 'string' },
  ];

  return standardizedCandidateStatsKeys.reduce(function(report: any, keyInfo) {
    let keysToLookFor = [keyInfo.key];
    if (keyInfo.altKeys) {
      keysToLookFor = keysToLookFor.concat(keyInfo.altKeys);
    }
    var key = keysToLookFor.find(key => key in input);
    if (key && typeof input[key] === keyInfo.type) {
      report[keyInfo.key] = input[key];
    }

    return report;
  }, {});
}

function extractSelectedActiveCandidatePair(stats: RTCStatsReport) : SelectedIceCandidatePairStats | null {
  let selectedCandidatePairId:string|null = null;
  const candidatePairs: RTCIceCandidatePairStats[] = [];
  stats.forEach(stat => {
    if (stat.type === 'transport' && stat.selectedCandidatePairId) {
      selectedCandidatePairId = stat.selectedCandidatePairId;
    } else if (stat.type === 'candidate-pair') {
      candidatePairs.push(stat);
    }
  });

  const activeCandidatePairStatsFound = candidatePairs.find(pair =>
    // Firefox
    pair.selected ||
    // Spec-compliant way
    (selectedCandidatePairId && pair.id === selectedCandidatePairId)
  );

  if (!activeCandidatePairStatsFound) {
    return null;
  }

  const activeCandidatePairStats = activeCandidatePairStatsFound as RTCIceCandidatePairStats;
  const activeLocalCandidateStats = stats.get(activeCandidatePairStats.localCandidateId);
  const activeRemoteCandidateStats = stats.get(activeCandidatePairStats.remoteCandidateId);
  if (!activeLocalCandidateStats || !activeRemoteCandidateStats) {
    return null;
  }

  return {
    localCandidate: makeStandardCandidateStats(activeLocalCandidateStats),
    remoteCandidate: makeStandardCandidateStats(activeRemoteCandidateStats)
  };
}

