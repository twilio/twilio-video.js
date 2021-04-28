import { LocalTrackOptions } from "./types";

export interface LocalDataTrackOptions extends LocalTrackOptions {
  maxPacketLifeTime?: number | null;
  maxRetransmits?: number | null;
  ordered?: boolean;
}
