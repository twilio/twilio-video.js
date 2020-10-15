
export type NetworkQualityLevel = number;

export class NetworkQualityStats {
  level: NetworkQualityLevel;
  audio: NetworkQualityAudioStats | null;
  video: NetworkQualityVideoStats | null;
}

export class NetworkQualityMediaStats {
  send: NetworkQualityLevel;
  recv: NetworkQualityLevel;
  sendStats: NetworkQualitySendOrRecvStats | null;
  recvStats: NetworkQualitySendOrRecvStats | null;
}

export class NetworkQualityAudioStats extends NetworkQualityMediaStats {}

export class NetworkQualityVideoStats extends NetworkQualityMediaStats {}

export class NetworkQualitySendOrRecvStats {
  bandwidth: NetworkQualityBandwidthStats | null;
  latency: NetworkQualityLatencyStats | null;
  fractionLost: NetworkQualityFractionLostStats | null;
}

export class NetworkQualityBandwidthStats {
  actual: number | null;
  available: number | null;
  level: NetworkQualityLevel | null;
}
export class NetworkQualityFractionLostStats {
  fractionLost: number | null;
  level: NetworkQualityLevel | null;
}
export class NetworkQualityLatencyStats {
  jitter: number | null;
  rtt: number | null;
  level: NetworkQualityLevel | null;
}
