'use strict';

const assert = require('assert');

const IceReport = require('../../../../lib/stats/icereport');
const SenderReport = require('../../../../lib/stats/senderreport');
const ReceiverReport = require('../../../../lib/stats/receiverreport');
const PeerConnectionReport = require('../../../../lib/stats/peerconnectionreport');

describe('PeerConnectionReport', () => {
  describe('.summarize()', () => {
    const ice = new IceReport(1, 2, 3, 4);

    const audio = {
      send: [
        new SenderReport('0', '1', 1, 2),
        new SenderReport('2', '3', 3, 4)
      ],
      recv: [
        new ReceiverReport('4', '5', 5, 6, 7, 8, 9),
        new ReceiverReport('6', '7', 10, 11, 12, 13, 14)
      ]
    };

    const video = {
      send: [
        new SenderReport('8', '9', 15, 16),
        new SenderReport('a', 'b', 17, 18)
      ],
      recv: [
        new ReceiverReport('c', 'd', 19, 20, 21, 22, 23),
        new ReceiverReport('e', 'f', 24, 25, 26, 27, 28)
      ]
    };

    let report;

    beforeEach(() => {
      report = new PeerConnectionReport(ice, audio, video);
    });

    it('returns a PeerConnectionSummary', () => {
      const summary = report.summarize();
      assert.deepEqual(summary, {
        ice: {
          send: 1,
          recv: 2,
          availableSend: 3,
          rtt: 4
        },
        send: {
          bitrate: 36,
          rtt: 10
        },
        recv: {
          bitrate: 58,
          fractionLost: 17.5,
          jitter: 18.5
        },
        audio: {
          send: {
            bitrate: 4,
            rtt: 3
          },
          recv: {
            bitrate: 15,
            fractionLost: 10.5,
            jitter: 11.5
          }
        },
        video: {
          send: {
            bitrate: 32,
            rtt: 17
          },
          recv: {
            bitrate: 43,
            fractionLost: 24.5,
            jitter: 25.5
          }
        },
      });
    });
  });
});
