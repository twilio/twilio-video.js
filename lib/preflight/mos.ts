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

export function mosToScore(mosValue: number|null|undefined): number {
  let score = 0;
  if (!mosValue) {
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
