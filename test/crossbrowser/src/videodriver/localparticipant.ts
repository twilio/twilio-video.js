import SDKDriver from '../../../lib/sdkdriver/src';
import ParticipantDriver from './participant';

export default class LocalParticipantDriver extends ParticipantDriver {
  private readonly _sdkDriver: SDKDriver;
  audioTrackPublications: Map<string, any>;
  dataTrackPublications: Map<string, any>;
  trackPublications: Map<string, any>;
  videoTrackPublications: Map<string, any>;

  constructor(sdkDriver: SDKDriver, serializedLocalParticipant: any) {
    super(sdkDriver, serializedLocalParticipant);
    this._sdkDriver = sdkDriver;
  }

  private _handleTrackPublicationFailed(source: any, args: any): void {
    this._update(source);
    const [ serializedError, serializedLocalTrack ] = args;
    const error: any = new Error(serializedError.message);
    error.code = serializedError.code;
    this.emit('trackPublicationFailed', error, serializedLocalTrack);
  }

  private _handleTrackPublished(source: any, args: any): void {
    this._update(source);
    const serializedLocalTrackPublication: any = args[0];
    this.emit('trackPublished', serializedLocalTrackPublication);
  }

  protected _reemitEvents(data: any) {
    const { type, source, args } = data;
    if (source.sid !== this.sid) {
      return;
    }
    switch (type) {
      case 'trackPublicationFailed':
        this._handleTrackPublicationFailed(source, args);
        break;
      case 'trackPublished':
        this._handleTrackPublished(source, args);
        break;
    }
  }

  protected _update(source: any): void {
    super._update(source);
    const {
      audioTrackPublications,
      dataTrackPublications,
      trackPublications,
      videoTrackPublications
    } = source;

    this.audioTrackPublications = new Map(audioTrackPublications.map((publication: any) => [
      publication.trackSid,
      publication
    ]));
    this.dataTrackPublications = new Map(dataTrackPublications.map((publication: any) => [
      publication.trackSid,
      publication
    ]));
    this.trackPublications = new Map(trackPublications.map((publication: any) => [
      publication.trackSid,
      publication
    ]));
    this.videoTrackPublications = new Map(videoTrackPublications.map((publication: any) => [
      publication.trackSid,
      publication
    ]));
  }

  async publishTrack(localTrack: any): Promise<any> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'publishTrack',
      args: [localTrack.id],
      target: this.sid
    });

    if (error) {
      const err: any = new Error(error.message);
      err.code = error.code;
      throw err;
    }
    return result;
  }

  async publishTracks(localTracks: Array<any>): Promise<Array<any>> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'publishTracks',
      args: [localTracks.map((track: any) => track.id)],
      target: this.sid
    });

    if (error) {
      throw error;
    }
    return result;
  }

  setParameters(encodingParameters: any): void {
    this._sdkDriver.sendRequest({
      api: 'setParameters',
      args: [encodingParameters],
      target: this.sid
    }).then(() => {
      // Do nothing.
    }, () => {
      // Do nothing.
    });
  }

  async unpublishTrack(localTrack: any): Promise<any> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'unpublishTrack',
      args: [localTrack.id],
      target: this.sid
    });

    if (error) {
      throw new Error(error.message);
    }

    const { kind, trackSid } = result;
    this.trackPublications.delete(trackSid);
    this[`${kind}TrackPublications`].delete(trackSid);

    this.tracks.delete(localTrack.id);
    this[`${kind}Tracks`].delete(localTrack.id);
    return result;
  }

  async unpublishTracks(localTracks: Array<any>): Promise<Array<any>> {
    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'unpublishTracks',
      args: [localTracks.map((track: any) => track.id)],
      target: this.sid
    });

    if (error) {
      throw error;
    }
    return result;
  }
}
