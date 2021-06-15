export interface RTCOAuthCredential {
  accessToken: string;
  macKey: string;
}

// eslint-disable-next-line quotes
export type RTCStatsType = "candidate-pair" | "certificate" | "codec" | "csrc" | "data-channel" | "ice-server" | "inbound-rtp" | "local-candidate" | "media-source" | "outbound-rtp" | "peer-connection" | "receiver" | "remote-candidate" | "remote-inbound-rtp" | "remote-outbound-rtp" | "sctp-transport" | "sender" | "stream" | "track" | "transceiver" | "transport";
export interface RTCStats {
  id?: string;
  timestamp?: number;
  type?: RTCStatsType;
}

export type RTCIceCredentialType = 'oauth' | 'password';

export interface RTCIceServer {
  credential?: string | RTCOAuthCredential;
  credentialType?: RTCIceCredentialType;
  urls: string | string[];
  username?: string;
}
