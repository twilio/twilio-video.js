export interface PreflightOptions {
  duration?: number;
  region?: string;
}

export interface TimeMeasurement {
  start: number,
  end?: number,
  duration?: number
}

export interface NetworkTiming {
  connect?: TimeMeasurement;
  dtls?: TimeMeasurement;
  ice?: TimeMeasurement;
  peerConnection?: TimeMeasurement;
  media?: TimeMeasurement;
}

export interface RTCIceCandidateStats {
  transportId?: string;
  address?: string;
  port?: number;
  protocol?: string;
  candidateType?: string;
  priority?: number;
  url?: string;
  relayProtocol?: string;
}

export interface SelectedIceCandidatePairStats {
  localCandidate: RTCIceCandidateStats;
  remoteCandidate: RTCIceCandidateStats;
}

export interface Stats {
  average: number;
  max: number;
  min: number;
}

export interface ProgressEvent {
  duration: number;
  name: string;
}

export interface PreflightReportStats {
  jitter: Stats|null;
  rtt: Stats|null;
  packetLoss: Stats|null;
}

export interface PreflightTestReport {
  testTiming: TimeMeasurement;
  networkTiming: NetworkTiming;
  stats: PreflightReportStats
  iceCandidateStats: RTCIceCandidateStats[];
  selectedIceCandidatePairStats: SelectedIceCandidatePairStats | null;
  progressEvents: ProgressEvent[];
}
