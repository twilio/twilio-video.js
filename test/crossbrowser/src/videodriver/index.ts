import { join } from 'path';
import SDKDriver from '../../../lib/sdkdriver/src';
import BrowserDriver from '../../../lib/sdkdriver/src/testdriver/browser';
import WSServerTransport from '../../../lib/sdkdriver/src/transport/websocket/server';
import RoomDriver from './room';

export interface TwilioError extends Error {
  code: number;
}

interface VideoDriverOptions {
  browser: 'chrome' | 'firefox';
  realm: 'dev' | 'prod' | 'stage';
  version: string;
}

/**
 * Video SDK driver.
 * @classdesc A {@link VideoDriver} manages the execution of the APIs
 *   of the Video SDK that is loaded in the browser.
 */
export default class VideoDriver {
  private readonly _options: VideoDriverOptions;
  private _createSdkDriver: Promise<SDKDriver> | null;
  private _sdkDriver: SDKDriver | null;

  /**
   * Construct the Video SDK url from the {@link VideoDriverOptions}.
   * @static
   * @param {VideoDriverOptions} options
   * @returns {string}
   */
  static sdkUrl(options: VideoDriverOptions): string {
    const subdomain: string = {
      dev: 'dev',
      prod: 'media',
      stage: 'stage'
    }[options.realm];
    return `//${subdomain}.twiliocdn.com/sdk/js/video/releases/${options.version}/twilio-video.js`;
  }

  /**
   * Constructor.
   * @param {VideoDriverOptions} options
   */
  constructor(options: VideoDriverOptions) {
    this._options = {
      browser: 'chrome',
      realm: 'prod',
      ...options
    };
    this._createSdkDriver = null;
    this._sdkDriver = null;
  }

  /**
   * Create a {@link LocalTrack} in the browser.
   * @private
   * @param {string} kind
   * @param {LocalDataTrackOptions|CreateLocalTrackOptions} options
   * @returns {Promise<LocalDataTrackDriver|LocalMediaTrackDriver>}
   */
  private async _createLocalTrack(kind: string, options: any): Promise<any> {
    this._sdkDriver = this._sdkDriver || await createSdkDriver(this._options);

    const { error, result } = await this._sdkDriver.sendRequest({
      api: `createLocalTrack`,
      args: [kind, options]
    });

    if (error) {
      throw error;
    }
    return result;
  }

  /**
   * Ensure only one {@link SDKDriver} is created when any of
   *   the public methods are called multiple times.
   * @private
   * @returns {Promise<SDKDriver>}
   */
  private async _getSdkDriver(): Promise<SDKDriver> {
    this._createSdkDriver = this._createSdkDriver || createSdkDriver(this._options);
    return await this._createSdkDriver;
  }

  /**
   * Close the {@link VideoDriver}.
   * @returns {void}
   */
  close(): void {
    if (this._sdkDriver) {
      this._sdkDriver.close();
    } else if (this._createSdkDriver) {
      this._createSdkDriver.then((sdkDriver: SDKDriver) => sdkDriver.close());
    }
    this._createSdkDriver = null;
    this._sdkDriver = null;
  }

  /**
   * Connect to a {@link Room} in the browser.
   * @param {string} token
   * @param {ConnectOptions} options
   * @returns {Promise<RoomDriver>}
   */
  async connect(token: string, options: any): Promise<RoomDriver> {
    this._sdkDriver = this._sdkDriver || await this._getSdkDriver();

    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'connect',
      args: [token, options]
    });

    if (error) {
      const err: TwilioError = new Error(error.message) as TwilioError;
      err.code = error.code;
      throw err;
    }
    return new RoomDriver(this._sdkDriver, result);
  }

  /**
   * Create a {@link LocalAudioTrack} in the browser.
   * @param {CreateLocalTrackOptions} options
   * @returns {Promise<LocalMediaTrackDriver>}
   */
  createLocalAudioTrack(options: any): Promise<any> {
    return this._createLocalTrack('audio', options);
  }

  /**
   * Create a {@link LocalDataTrack} in the browser.
   * @param {LocalDataTrackOptions} options
   * @returns {Promise<LocalDataTrackDriver>}
   */
  createLocalDataTrack(options: any): Promise<any> {
    return this._createLocalTrack('data', options);
  }

  /**
   * Create an array of {@link LocalMediaTrack}s in the browser.
   * @param {CreateLocalTracksOptions} options
   * @returns {Promise<Array<LocalMediaTrackDriver>>}
   */
  async createLocalTracks(options: any): Promise<any> {
    this._sdkDriver = this._sdkDriver || await this._getSdkDriver();

    const { error, result } = await this._sdkDriver.sendRequest({
      api: 'createLocalTracks',
      args: [options]
    });

    if (error) {
      throw error;
    }
    return result;
  }

  /**
   * Create a {@link LocalVideoTrack} in the browser.
   * @param {CreateLocalTrackOptions} options
   * @returns {Promise<LocalMediaTrackDriver>}
   */
  createLocalVideoTrack(options: any): Promise<any> {
    return this._createLocalTrack('video', options);
  }
}

/**
 * Create a {@link SDKDriver}.
 * @private
 * @param {VideoDriverOptions} options
 * @returns {Promise<SDKDriver>}
 */
async function createSdkDriver(options: VideoDriverOptions): Promise<SDKDriver> {
  const { browser } = options;
  const sdkUrl: string = VideoDriver.sdkUrl(options);
  const webServerRoot: string = join(__dirname, '..', 'browser');
  const browserDriver: any = new BrowserDriver(browser, webServerRoot, sdkUrl);

  await browserDriver.startWebServer();
  const transport: WSServerTransport = new WSServerTransport(browserDriver.webServer);
  return await SDKDriver.create(transport, browserDriver);
}
