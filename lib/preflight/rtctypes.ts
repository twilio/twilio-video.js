export interface RTCOAuthCredential {
  accessToken: string;
  macKey: string;
}

export type RTCStatsType = 'candidate-pair' | 'certificate' | 'codec' | 'csrc' | 'data-channel' | 'ice-server' | 'inbound-rtp' | 'local-candidate' | 'media-source' | 'outbound-rtp' | 'peer-connection' | 'receiver' | 'remote-candidate' | 'remote-inbound-rtp' | 'remote-outbound-rtp' | 'sctp-transport' | 'sender' | 'stream' | 'track' | 'transceiver' | 'transport';
export interface RTCStats {
  id?: string;
  timestamp?: number;
  type?: RTCStatsType;
}

export interface RTCIceServer {
  credential?: string;
  credentialType?: 'password' | undefined;
  urls: string | string[];
  username?: string;
}


type RTCStatsIceCandidatePairState = 'failed' | 'frozen' | 'in-progress' | 'succeeded' | 'waiting';

export interface RTCIceCandidatePairStats extends RTCStats {
  selected: boolean,
  availableIncomingBitrate?: number;
  availableOutgoingBitrate?: number;
  bytesDiscardedOnSend?: number;
  bytesReceived?: number;
  bytesSent?: number;
  circuitBreakerTriggerCount?: number;
  consentExpiredTimestamp?: number;
  consentRequestsSent?: number;
  currentRoundTripTime?: number;
  currentRtt?: number;
  firstRequestTimestamp?: number;
  lastPacketReceivedTimestamp?: number;
  lastPacketSentTimestamp?: number;
  lastRequestTimestamp?: number;
  lastResponseTimestamp?: number;
  localCandidateId?: string;
  nominated?: boolean;
  packetsDiscardedOnSend?: number;
  packetsReceived?: number;
  packetsSent?: number;
  priority?: number;
  remoteCandidateId?: string;
  requestsReceived?: number;
  requestsSent?: number;
  responsesReceived?: number;
  responsesSent?: number;
  retransmissionsReceived?: number;
  retransmissionsSent?: number;
  state?: RTCStatsIceCandidatePairState;
  totalRoundTripTime?: number;
  totalRtt?: number;
  transportId?: string;
}
