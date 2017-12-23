import { createDocker } from '../../util';
import BrowserDriver from './base';

/**
 * Docker browser process driver.
 * @class
 * @classdesc A {@link DockerBrowserDriver} manages a Docker browser process
 *   where the cross-browser test is running.
 */
export default class DockerBrowserDriver extends BrowserDriver {
  private _docker: any;

  /**
   * Constructor.
   * @param {"chrome" | "firefox"} browser
   * @param {string} webServerRoot - Root folder of the web server
   * @param {string} sdkUrl
   */
  constructor(browser: 'chrome' | 'firefox', webServerRoot: string, sdkUrl: string) {
    super({
      browser,
      host: process.env.DOCKER_HOST_IP || 'localhost',
      params: { sdkUrl },
      webServerRoot
    });
    this._docker = null;
  }

  /**
   * Start the browser process.
   * @param {string} url - URL for running the SDK setup code
   * @returns {Promise<void>}
   */
  startBrowser(url: string): Promise<void> {
    return this._docker ? Promise.resolve() : new Promise((resolve, reject) => {
      const { browser } = this._options;
      const { DOCKER_CHROME_AND_FIREFOX } = process.env;

      this._docker = createDocker(browser, DOCKER_CHROME_AND_FIREFOX as string, url);
      const timeout = setTimeout(resolve, 500);

      this._docker.once('error', (error: any) => {
        this._docker = null;
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Stop the browser process.
   * @returns {void}
   */
  stopBrowser(): void {
    if (this._docker) {
      this._docker.kill();
      this._docker = null;
    }
  }
}
