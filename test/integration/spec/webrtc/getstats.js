const assert = require('assert');

const {
  activeIceCandidatePairStatsNullProps,
  localCandidateStatsNullProps,
  remoteCandidateStatsNullProps
} = require('../../../lib/webrtc/util');

const getStats = require('../../../../es5/webrtc/getstats');
const getUserMedia = require('../../../../es5/webrtc/getusermedia');
const RTCPeerConnection = require('../../../../es5/webrtc/rtcpeerconnection');
const { guessBrowser } = require('../../../../es5/webrtc/util');
const { getSdpFormat } = require('../../../../es5/webrtc/util/sdp');

const guess = guessBrowser();
const isFirefox = guess === 'firefox';
const isSafari = guess === 'safari';
const sdpFormat = getSdpFormat();

(isSafari && sdpFormat === 'planb' ? describe.skip : describe)(`getStats(${sdpFormat})`, function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(10000);

  context('should return a Promise that resolves with a StandardizedStatsResponse which has', () => {
    let pc1;
    let pc2;
    let stats;
    let stream;

    before(async () => {
      stream = await getUserMedia({
        audio: true,
        fake: true,
        video: true
      });

      pc1 = new RTCPeerConnection({
        iceServers: [{
          urls: 'stun:stun.l.google.com:19302'
        }]
      });

      pc2 = new RTCPeerConnection({
        iceServers: [{
          urls: 'stun:stun.l.google.com:19302'
        }]
      });

      stream.getTracks().forEach(track => pc1.addTrack(track, stream));
      stream.getTracks().forEach(track => pc2.addTrack(track, stream));

      const deferred = {};
      deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
      });

      pc1.addEventListener('icecandidate', e => {
        if (e.candidate) {
          pc2.addIceCandidate(e.candidate);
        }
      });

      pc2.addEventListener('icecandidate', e => {
        if (e.candidate) {
          pc1.addIceCandidate(e.candidate);
        }
      });

      pc1.addEventListener('iceconnectionstatechange', e => {
        if (pc1.iceConnectionState === 'connected') {
          deferred.resolve();
        }
      });

      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);

      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);
      await deferred.promise;

      // wait couple of seconds, and get stats
      await new Promise(resolve => setTimeout(resolve, 2000));

      stats = await getStats(pc1);
    });

    ['localAudioTrackStats', 'localVideoTrackStats', 'remoteAudioTrackStats', 'remoteVideoTrackStats'].forEach(trackType => {
      it('.' + trackType, () => {
        assert.equal(stats[trackType].length, 1, `expected to have data about ${trackType}`);

        const trackStats = stats[trackType][0];
        assert(trackStats, `expected to have property: ${stats}.${trackType}[0]`);

        [
          { key: 'frameWidthInput', type: 'number' },
          { key: 'frameHeightInput', type: 'number' },
          { key: 'frameWidthSent', type: 'number' },
          { key: 'frameHeightSent', type: 'number' },
          { key: 'ssrc', type: 'string' },
          { key: 'timestamp', type: 'number' },
          { key: 'bytesReceived', type: 'number' },
          { key: 'bytesSent', type: 'number' },
          { key: 'packetsSent', type: 'number' },
          { key: 'packetsReceived', type: 'number' },
          { key: 'trackId', type: 'string' },
          { key: 'jitter', type: 'number' },
          { key: 'packetsLost', type: 'number' },
          { key: 'roundTripTime', type: 'number' }
        ].forEach(({ key, type }) => {
          // eslint-disable-next-line no-prototype-builtins
          if (trackStats.hasOwnProperty(key)) {
            assert.equal(typeof trackStats[key], type, `typeof ${stats}.${trackType}[0].${key} ("${typeof trackStats[key]}") should be "${type}"`);
          }
        });
      });
    });

    it('.activeIceCandidatePair', () => {
      const { activeIceCandidatePair } = stats;
      const { localCandidate, remoteCandidate } = activeIceCandidatePair;

      [
        { key: 'candidateType', type: 'string' },
        { key: 'ip', type: 'string' },
        { key: 'port', type: 'number' },
        { key: 'priority', type: 'number' },
        { key: 'protocol', type: 'string' },
        { key: 'url', type: 'string' }
      ].forEach(({ key, type }) => {
        [localCandidate, remoteCandidate].forEach((candidate, i) => {
          const firefoxVersion = isFirefox && navigator.userAgent.match(/Firefox\/(\d+)\./)[1];
          if ([localCandidateStatsNullProps, remoteCandidateStatsNullProps][i][guess](firefoxVersion).has(key)) {
            assert.equal(candidate[key], null);
            return;
          }
          if (key === 'candidateType') {
            const candidateTypes = new Set([
              'host',
              'prflx',
              'relay',
              'srflx'
            ]);
            assert(candidateTypes.has(candidate[key]));
            return;
          }
          if (key === 'protocol') {
            const protocols = new Set([
              'tcp',
              'udp'
            ]);
            assert(protocols.has(candidate[key]));
            return;
          }
          assert.equal(typeof candidate[key], type, `typeof candidate.${key} ("${typeof candidate[key]}") should be "${type}"`);
        });
      });
      [
        { key: 'deleted', type: 'boolean' },
        { key: 'relayProtocol', type: 'string' }
      ].forEach(({ key, type }) => {
        const firefoxVersion = isFirefox && navigator.userAgent.match(/Firefox\/(\d+)\./)[1];
        if (localCandidateStatsNullProps[guess](firefoxVersion).has(key)) {
          assert.equal(localCandidate[key], null);
          return;
        }
        if (key === 'relayProtocol') {
          assert(new Set([
            'tcp',
            'tls',
            'udp'
          ]).has(localCandidate[key]));
          return;
        }
        assert.equal(typeof localCandidate[key], type, `typeof localCandidate.${key} ("${typeof localCandidate[key]}") should be "${type}"`);
      });

      [
        { key: 'availableIncomingBitrate', type: 'number' },
        { key: 'availableOutgoingBitrate', type: 'number' },
        { key: 'bytesReceived', type: 'number' },
        { key: 'bytesSent', type: 'number' },
        { key: 'consentRequestsSent', type: 'number' },
        { key: 'currentRoundTripTime', type: 'number' },
        { key: 'lastPacketReceivedTimestamp', type: 'number' },
        { key: 'lastPacketSentTimestamp', type: 'number' },
        { key: 'nominated', type: 'boolean' },
        { key: 'priority', type: 'number' },
        { key: 'readable', type: 'boolean' },
        { key: 'requestsReceived', type: 'number' },
        { key: 'requestsSent', type: 'number' },
        { key: 'responsesReceived', type: 'number' },
        { key: 'responsesSent', type: 'number' },
        { key: 'retransmissionsReceived', type: 'number' },
        { key: 'retransmissionsSent', type: 'number' },
        { key: 'state', type: 'string' },
        { key: 'totalRoundTripTime', type: 'number' },
        { key: 'transportId', type: 'string' },
        { key: 'writable', type: 'boolean' }
      ].forEach(({ key, type }) => {
        if (activeIceCandidatePairStatsNullProps[guess].has(key) && activeIceCandidatePair[key] === null) {
          return;
        }
        if (key === 'state') {
          assert(new Set([
            'failed',
            'frozen',
            'in-progress',
            'succeeded',
            'waiting'
          ]).has(activeIceCandidatePair[key]));
          return;
        }
        assert.equal(typeof activeIceCandidatePair[key], type, `typeof activeIceCandidatePair.${key} ("${typeof activeIceCandidatePair[key]}") should be "${type}"`);
      });
    });

    after(() => {
      stream.getTracks().forEach(track => track.stop());
      pc1.close();
      pc2.close();
    });
  });
});
