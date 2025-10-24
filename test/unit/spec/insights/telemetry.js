'use strict';

const assert = require('assert');
const sinon = require('sinon');
const telemetry = require('../../../../lib/insights/telemetry');

describe('Telemetry', () => {
  let mockPublisher;
  let mockLog;
  let connectTimestamp;

  beforeEach(() => {
    connectTimestamp = Date.now();
    mockPublisher = { publish: sinon.spy() };
    mockLog = {
      debug: sinon.spy(),
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy()
    };
  });

  afterEach(() => {
    telemetry.reset();
  });

  describe('event publishing', () => {
    it('should publish events with enriched payload and log at correct level', () => {
      telemetry.configure({ publisher: mockPublisher, log: mockLog, connectTimestamp });

      telemetry.info({ group: 'network', name: 'type-changed', payload: { type: 'wifi' } });
      telemetry.warning({ group: 'quality', name: 'degraded', payload: { reason: 'cpu' } });
      telemetry.error({ group: 'connection', name: 'failed' });

      sinon.assert.calledThrice(mockPublisher.publish);
      sinon.assert.calledWith(mockPublisher.publish.getCall(0), 'network', 'type-changed', sinon.match({
        level: 'info',
        type: 'wifi',
        elapsedTime: sinon.match.number
      }));
      sinon.assert.calledWith(mockPublisher.publish.getCall(1), 'quality', 'degraded', sinon.match({
        level: 'warning',
        reason: 'cpu',
        elapsedTime: sinon.match.number
      }));
      sinon.assert.calledWith(mockPublisher.publish.getCall(2), 'connection', 'failed', sinon.match({
        level: 'error',
        elapsedTime: sinon.match.number
      }));

      sinon.assert.calledOnce(mockLog.info);
      sinon.assert.calledOnce(mockLog.warn);
      sinon.assert.calledOnce(mockLog.error);
    });

    it('should not publish when no publisher is registered', () => {
      telemetry.info({ group: 'test', name: 'event' });
      telemetry.warning({ group: 'test', name: 'event' });
      telemetry.error({ group: 'test', name: 'event' });

      sinon.assert.notCalled(mockPublisher.publish);
    });
  });

  describe('lifecycle', () => {
    it('should stop publishing after reset', () => {
      telemetry.configure({ publisher: mockPublisher, log: mockLog, connectTimestamp });
      telemetry.info({ group: 'test', name: 'event1' });

      sinon.assert.calledOnce(mockPublisher.publish);

      telemetry.reset();
      telemetry.info({ group: 'test', name: 'event2' });

      sinon.assert.calledOnce(mockPublisher.publish);
      assert.strictEqual(telemetry.isEnabled, false);
    });
  });

  describe('configure() API', () => {
    it('should configure telemetry with all parameters', () => {
      telemetry.configure({ publisher: mockPublisher, log: mockLog, connectTimestamp });

      assert.strictEqual(telemetry.isEnabled, true);

      telemetry.info({ group: 'test', name: 'event' });
      sinon.assert.calledOnce(mockPublisher.publish);
    });

    it('should throw error when publisher is missing', () => {
      assert.throws(() => {
        telemetry.configure({ log: mockLog, connectTimestamp });
      }, /requires publisher, log, and connectTimestamp/);
    });

    it('should throw error when log is missing', () => {
      assert.throws(() => {
        telemetry.configure({ publisher: mockPublisher, connectTimestamp });
      }, /requires publisher, log, and connectTimestamp/);
    });

    it('should throw error when connectTimestamp is missing', () => {
      assert.throws(() => {
        telemetry.configure({ publisher: mockPublisher, log: mockLog });
      }, /requires publisher, log, and connectTimestamp/);
    });

    it('should support method chaining', () => {
      const result = telemetry.configure({ publisher: mockPublisher, log: mockLog, connectTimestamp });
      assert.strictEqual(result, telemetry);
    });
  });

  describe('reset() API', () => {
    it('should reset telemetry and return this', () => {
      telemetry.configure({ publisher: mockPublisher, log: mockLog, connectTimestamp });
      const result = telemetry.reset();

      assert.strictEqual(result, telemetry);
      assert.strictEqual(telemetry.isEnabled, false);
    });

    it('should stop publishing after reset', () => {
      telemetry.configure({ publisher: mockPublisher, log: mockLog, connectTimestamp });
      telemetry.reset();

      telemetry.info({ group: 'test', name: 'event' });
      sinon.assert.notCalled(mockPublisher.publish);
    });
  });

  describe('namespaced event APIs', () => {
    beforeEach(() => {
      telemetry.configure({ publisher: mockPublisher, log: mockLog, connectTimestamp });
    });

    describe('getUserMedia events', () => {
      it('should publish succeeded event', () => {
        telemetry.getUserMedia.succeeded();

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'get-user-media', 'succeeded', sinon.match({
          level: 'info',
          elapsedTime: sinon.match.number
        }));
      });

      it('should publish denied event', () => {
        telemetry.getUserMedia.denied();

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'get-user-media', 'denied', sinon.match({
          level: 'info'
        }));
      });

      it('should publish failed event with error', () => {
        const error = { name: 'TestError', message: 'Test message' };
        telemetry.getUserMedia.failed(error);

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'get-user-media', 'failed', sinon.match({
          level: 'info',
          name: 'TestError',
          message: 'Test message'
        }));
      });
    });

    describe('network events', () => {
      it('should publish type changed event', () => {
        telemetry.network.typeChanged('wifi');

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'network', 'network-type-changed', sinon.match({
          level: 'info',
          networkType: 'wifi'
        }));
      });

      it('should publish information changed event', () => {
        telemetry.network.informationChanged({
          downlink: 10,
          effectiveType: '4g',
          rtt: 50
        });

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'network', 'network-information-changed', sinon.match({
          level: 'info',
          downlink: 10,
          effectiveType: '4g',
          rtt: 50
        }));
      });
    });

    describe('application events', () => {
      it('should publish resumed event', () => {
        telemetry.application.resumed();

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'application', 'resumed', sinon.match({
          level: 'info'
        }));
      });

      it('should publish backgrounded event', () => {
        telemetry.application.backgrounded();

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'application', 'backgrounded', sinon.match({
          level: 'info'
        }));
      });

      it('should publish terminated event', () => {
        telemetry.application.terminated();

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'application', 'terminated', sinon.match({
          level: 'info'
        }));
      });
    });

    describe('track events', () => {
      it('should publish stalled event', () => {
        telemetry.track.stalled('MT123', 0.3, 0.5, 'video');

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'track-warning-raised', 'track-stalled', sinon.match({
          level: 'warning',
          trackSid: 'MT123',
          frameRate: 0.3,
          threshold: 0.5,
          trackType: 'video'
        }));
      });

      it('should publish resumed event', () => {
        telemetry.track.resumed('MT123', 5.5, 5.0);

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'track-warning-cleared', 'track-stalled', sinon.match({
          level: 'info',
          trackSid: 'MT123',
          frameRate: 5.5,
          threshold: 5.0
        }));
      });
    });

    describe('quality events', () => {
      it('should publish limitation changed event', () => {
        telemetry.quality.limitationChanged('MT456', 'bandwidth');

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'quality', 'quality-limitation-state-changed', sinon.match({
          level: 'info',
          trackSid: 'MT456',
          qualityLimitationReason: 'bandwidth'
        }));
      });

      it('should publish stats report event', () => {
        const statsPayload = { peerConnectionId: 'PC123', localVideoTrackStats: [] };
        telemetry.quality.statsReport(statsPayload);

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'quality', 'stats-report', sinon.match({
          level: 'info',
          peerConnectionId: 'PC123'
        }));
      });

      it('should publish ice candidate pair event', () => {
        const icePayload = { state: 'connected', priority: 100 };
        telemetry.quality.iceCandidatePair(icePayload);

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'quality', 'active-ice-candidate-pair', sinon.match({
          level: 'info',
          state: 'connected',
          priority: 100
        }));
      });
    });

    describe('system events', () => {
      it('should publish cpu pressure changed event', () => {
        telemetry.system.cpuPressureChanged('serious');

        sinon.assert.calledOnce(mockPublisher.publish);
        sinon.assert.calledWith(mockPublisher.publish, 'system', 'cpu-pressure-changed', sinon.match({
          level: 'info',
          resourceType: 'cpu',
          pressure: 'serious'
        }));
      });
    });

    describe('RTCPeerConnection events', () => {
      describe('connectionState', () => {
        ['new', 'connecting', 'connected', 'disconnected', 'failed', 'closed'].forEach(state => {
          it(`should publish ${state} event`, () => {
            telemetry.pc.connectionState('PC123', state);

            sinon.assert.calledOnce(mockPublisher.publish);
            sinon.assert.calledWith(mockPublisher.publish, 'pc-connection-state', state, sinon.match({
              level: 'debug',
              peerConnectionId: 'PC123'
            }));
          });
        });
      });

      describe('signalingState', () => {
        ['stable', 'have-local-offer', 'have-remote-offer', 'have-local-pranswer', 'have-remote-pranswer', 'closed'].forEach(state => {
          it(`should publish ${state} event`, () => {
            telemetry.pc.signalingState('PC123', state);

            sinon.assert.calledOnce(mockPublisher.publish);
            sinon.assert.calledWith(mockPublisher.publish, 'pc-signaling-state', state, sinon.match({
              level: 'debug',
              peerConnectionId: 'PC123'
            }));
          });
        });
      });

      describe('iceGatheringState', () => {
        ['new', 'gathering', 'complete'].forEach(state => {
          it(`should publish ${state} event`, () => {
            telemetry.pc.iceGatheringState('PC123', state);

            sinon.assert.calledOnce(mockPublisher.publish);
            sinon.assert.calledWith(mockPublisher.publish, 'ice-gathering-state', state, sinon.match({
              level: 'debug',
              peerConnectionId: 'PC123'
            }));
          });
        });
      });

      describe('iceConnectionState', () => {
        ['new', 'checking', 'connected', 'completed', 'disconnected', 'closed'].forEach(state => {
          it(`should publish ${state} event with debug level`, () => {
            telemetry.pc.iceConnectionState('PC123', state);

            sinon.assert.calledOnce(mockPublisher.publish);
            sinon.assert.calledWith(mockPublisher.publish, 'ice-connection-state', state, sinon.match({
              level: 'debug',
              peerConnectionId: 'PC123'
            }));
          });
        });

        it('should publish failed event with error level', () => {
          telemetry.pc.iceConnectionState('PC123', 'failed');

          sinon.assert.calledOnce(mockPublisher.publish);
          sinon.assert.calledWith(mockPublisher.publish, 'ice-connection-state', 'failed', sinon.match({
            level: 'error',
            peerConnectionId: 'PC123'
          }));
        });
      });

      describe('dtlsTransportState', () => {
        ['new', 'connecting', 'connected'].forEach(state => {
          it(`should publish ${state} event with debug level`, () => {
            telemetry.pc.dtlsTransportState('PC123', state);

            sinon.assert.calledOnce(mockPublisher.publish);
            sinon.assert.calledWith(mockPublisher.publish, 'dtls-transport-state', state, sinon.match({
              level: 'debug',
              peerConnectionId: 'PC123'
            }));
          });
        });

        it('should publish closed event with warning level', () => {
          telemetry.pc.dtlsTransportState('PC123', 'closed');

          sinon.assert.calledOnce(mockPublisher.publish);
          sinon.assert.calledWith(mockPublisher.publish, 'dtls-transport-state', 'closed', sinon.match({
            level: 'warning',
            peerConnectionId: 'PC123'
          }));
        });

        it('should publish failed event with error level', () => {
          telemetry.pc.dtlsTransportState('PC123', 'failed');

          sinon.assert.calledOnce(mockPublisher.publish);
          sinon.assert.calledWith(mockPublisher.publish, 'dtls-transport-state', 'failed', sinon.match({
            level: 'error',
            peerConnectionId: 'PC123'
          }));
        });
      });
    });
  });
});
