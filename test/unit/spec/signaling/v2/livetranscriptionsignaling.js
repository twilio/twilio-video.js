'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const LiveTranscriptionSignaling = require('../../../../../lib/signaling/v2/livetranscriptionsignaling');
const log = require('../../../../lib/fakelog');
const { waitForSometime } = require('../../../../../lib/util');

/**
 * Returns a mock Media Signaling Transport that can be used to test the LiveTranscriptionSignaling class.
 * For sake of simplicity, the mock transport will emit a fake transcription message when the 'publish' method is called.
 * @returns {EventEmitter} - Mock Media Signaling Transport
 */
const mockTransport = () => {
  const transport = new EventEmitter();
  transport.publish = message => {
    transport.emit('message', message);
  };
  return transport;
};

/**
 * Returns a new LiveTranscriptionSignaling instance with a mock transport.
 * This is a helper function to avoid repeating the same code in each test.
 * @param {EventEmitter} mst - Mock Media Signaling Transport
 * @returns {LiveTranscriptionSignaling}
 */
function makeTest(mst) {
  const getReceiver = () => {
    return Promise.resolve({
      kind: 'data',
      toDataTransport: () => mst,
      once: () => {}
    });
  };

  const subject = new LiveTranscriptionSignaling(getReceiver, { log });
  subject.setup('foo');
  return subject;
}

/**
 * Waits for the LiveTranscriptionSignaling instance to be ready.
 * @param {LiveTranscriptionSignaling} subject - The LiveTranscriptionSignaling instance
 * @returns {Promise} - A promise that resolves when the instance is ready
 */
function waitUntilReady(subject) {
  return new Promise(resolve => subject.once('ready', () => resolve()));
}

describe('LiveTranscriptionSignaling', () => {
  describe('constructor', () => {
    it('should create a new LiveTranscriptionSignaling instance', () => {
      const mediaSignalingTransport = mockTransport();
      const signalingInstance = makeTest(mediaSignalingTransport);
      assert(signalingInstance instanceof LiveTranscriptionSignaling, 'signalingInstance is an instance of LiveTranscriptionSignaling');
    });

    it('should initialize isEnabled as false', () => {
      const mediaSignalingTransport = mockTransport();
      const signalingInstance = makeTest(mediaSignalingTransport);
      assert.strictEqual(signalingInstance.isEnabled, false, 'isEnabled should be false initially');
    });
  });

  describe('message handling', () => {
    const mockTranscriptionMessage = {
      /* eslint-disable camelcase */
      language_code: 'en-US',
      partial_results: false,
      sequence_number: 1,
      /* eslint-enable camelcase */
      participant: 'PA0000',
      timestamp: '2025-01-01T12:00:00.000000000Z',
      track: 'MT0000',
      transcription: 'This is a fake caption',
      type: 'extension_transcriptions'
    };

    it('should emit a "transcription" event with the message payload if the message has a "type" of "extension_transcriptions"', async () => {
      const mediaSignalingTransport = mockTransport();
      const subject = makeTest(mediaSignalingTransport);

      await waitUntilReady(subject);

      const transcriptionPromise = new Promise(resolve => subject.on('transcription', resolve));

      mediaSignalingTransport.publish(mockTranscriptionMessage);

      const transcription = await transcriptionPromise;
      assert.strictEqual(transcription, mockTranscriptionMessage, 'transcription event was emitted with the correct message payload');
    });

    it('should be able to handle multiple transcription messages', async () => {
      const mediaSignalingTransport = mockTransport();
      const subject = makeTest(mediaSignalingTransport);
      await waitUntilReady(subject);

      const messages = [
        mockTranscriptionMessage,
        {
          ...mockTranscriptionMessage,
          /* eslint-disable camelcase */
          sequence_number: mockTranscriptionMessage.sequence_number + 1,
          transcription: 'Second message'
        }
      ];

      const receivedMessages = [];
      const transcriptionPromise = new Promise(resolve => {
        subject.on('transcription', transcription => {
          receivedMessages.push(transcription);
          if (receivedMessages.length === messages.length) {
            resolve(receivedMessages);
          }
        });
      });

      messages.forEach(msg => mediaSignalingTransport.publish(msg));
      const result = await transcriptionPromise;

      assert.deepStrictEqual(result, messages, 'transcription events should be received in order');
    });

    it('should not emit a "transcription" event if the message has a "type" different from "extension_transcriptions"', async () => {
      const mediaSignalingTransport = mockTransport();
      const subject = makeTest(mediaSignalingTransport);

      await waitUntilReady(subject);

      let transcriptionReceived = false;
      subject.on('transcription', () => {
        transcriptionReceived = true;
      });

      mediaSignalingTransport.publish({
        ...mockTranscriptionMessage,
        type: 'not_supported_message'
      });

      // Wait for 1 second to see if the transcription event is emitted
      await waitForSometime(1000);

      assert.strictEqual(transcriptionReceived, false, 'transcription event was not emitted');
    });
  });

  describe('isEnabled property', () => {
    it('should set isEnabled to true when the transport is ready', async () => {
      const mediaSignalingTransport = mockTransport();
      const signalingInstance = makeTest(mediaSignalingTransport);

      assert.strictEqual(signalingInstance.isEnabled, false, 'isEnabled should be false initially');

      await waitUntilReady(signalingInstance);

      assert.strictEqual(signalingInstance.isEnabled, true, 'isEnabled should be true after ready event');
    });

    it('should set isEnabled to false after teardown is called', async () => {
      const mediaSignalingTransport = mockTransport();
      const signalingInstance = makeTest(mediaSignalingTransport);

      await waitUntilReady(signalingInstance);

      signalingInstance._teardown();

      assert.strictEqual(signalingInstance.isEnabled, false, 'isEnabled should be false after teardown is called');
    });
  });
});
