const r0 = 94.768; // Constant used in computing "rFactor".
// copied from https://code.hq.twilio.com/client/sdk-frd/blob/master/voice/voice-mos-calculation.md
export function calculateMOS(rtt: number, jitter: number, fractionLost: number): number {
  // Compute the effective latency.
  const effectiveLatency: number = rtt + (jitter * 2) + 10;

  // Compute the initial "rFactor" from effective latency.
  let rFactor = 0;
  switch (true) {
    case effectiveLatency < 160:
      rFactor = r0 - (effectiveLatency / 40);
      break;
    case effectiveLatency < 1000:
      rFactor = r0 - ((effectiveLatency - 120) / 10);
      break;
  }

  // Adjust "rFactor" with the fraction of packets lost.
  switch (true) {
    case fractionLost <= (rFactor / 2.5):
      rFactor = Math.max(rFactor - fractionLost * 2.5, 6.52);
      break;
    default:
      rFactor = 0;
      break;
  }

  // Compute MOS from "rFactor".
  const mos: number = 1 +
    (0.035 * rFactor) +
    (0.000007 * rFactor) *
    (rFactor - 60) *
    (100 - rFactor);

  return mos;
}

type StandardizedReport = {
  trackId: string;
  timestamp: number; // The Unix timestamp in milliseconds
  ssrc: string; // SSRC of the MediaStreamTrack
  roundTripTime?: number; // Round trip time in milliseconds
  jitter?: number; // Jitter in milliseconds
  packetsLost?: number; // packets lost.
  packetsReceived?: number; // packets received.
  packetsSent?: number; // packets sent.
};

const lastReports = new Map<string, StandardizedReport>();
export function calculateMOSFromStandardizedStatsReport(report: StandardizedReport): number|null {
  const lastReport = lastReports.get(report.ssrc);
  let lastPackets = 0;
  let lastPacketsLost = 0;
  if (lastReport) {
    lastPackets = lastReport.packetsReceived || lastReport.packetsSent || 0;
    lastPacketsLost = lastReport.packetsLost || 0;
    lastReports.set(report.ssrc, report);
  }
  const { roundTripTime, jitter, packetsLost, packetsReceived, packetsSent } =  report;
  const newPackets = (packetsReceived || packetsSent || 0) - lastPackets;
  if (newPackets > 0 && roundTripTime) {
    const newPacketsLost = (packetsLost || 0) - lastPacketsLost;
    const fractionLost = newPacketsLost / newPackets;
    const score = calculateMOS(roundTripTime, jitter || 0, fractionLost);
    return score;
  }
  return null;
}

export function mosToScore(mosValue: number|null): number {
  let score = 0;
  if (mosValue === null) {
    score = 0;
  } else if  (mosValue > 4.2) {
    score = 5;
  } else if  (mosValue > 4.0) {
    score = 4;
  } else if  (mosValue > 3.6) {
    score = 3;
  } else if  (mosValue > 3) {
    score = 2;
  } else  {
    score = 1;
  }
  return score;
}

// module.exports = {
//   calculateMOS,
//   calculateMOSFromStandardizedStatsReport,
//   mosToScore
// }
