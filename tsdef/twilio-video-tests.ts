import * as Video from './index';

const localAudioTrack: Video.LocalAudioTrack | null = null;
const Track: Video.Track | null = null;

localAudioTrack.enable(true);
localAudioTrack.stop();

const trackKind = Track.kind;
const trackName = Track.name;
