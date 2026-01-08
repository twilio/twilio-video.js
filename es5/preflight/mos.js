"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMOS = calculateMOS;
exports.mosToScore = mosToScore;
var r0 = 94.768; // Constant used in computing "rFactor".
// copied from https://code.hq.twilio.com/client/sdk-frd/blob/master/voice/voice-mos-calculation.md
function calculateMOS(rtt, jitter, fractionLost) {
    // Compute the effective latency.
    var effectiveLatency = rtt + (jitter * 2) + 10;
    // Compute the initial "rFactor" from effective latency.
    var rFactor = 0;
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
    var mos = 1 +
        (0.035 * rFactor) +
        (0.000007 * rFactor) *
            (rFactor - 60) *
            (100 - rFactor);
    return mos;
}
function mosToScore(mosValue) {
    var score = 0;
    if (!mosValue) {
        score = 0;
    }
    else if (mosValue > 4.2) {
        score = 5;
    }
    else if (mosValue > 4.0) {
        score = 4;
    }
    else if (mosValue > 3.6) {
        score = 3;
    }
    else if (mosValue > 3) {
        score = 2;
    }
    else {
        score = 1;
    }
    return score;
}
//# sourceMappingURL=mos.js.map