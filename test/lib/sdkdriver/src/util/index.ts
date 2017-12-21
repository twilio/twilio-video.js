import { spawn } from 'child_process';
import * as express from 'express';
import { Server as HTTPServer, createServer } from 'http';
import { join } from 'path';
import { WebDriver } from 'selenium-webdriver';
import * as webdriver from './webdriver';

/**
 * Create a Docker container
 * @param {"chrome" | "firefox"} browser
 * @param {string} dockerScriptBinPath
 * @param {string} url - URL to load
 * @returns {ChildProcess}
 */
export function createDocker(browser: 'chrome' | 'firefox', dockerScriptBinPath: string, url: string): any {
  const dockerScript: string = join(dockerScriptBinPath, 'bin', `start-${browser}.sh`);
  return spawn(dockerScript, [url], {
    stdio: 'inherit'
  });
}

/**
 * Create a Selenium WebDriver
 * @param {"chrome" | "firefox"} browser
 * @returns {WebDriver}
 */
export function createWebDriver(browser: 'chrome' | 'firefox'): WebDriver {
  const { [browser]: buildWebDriver } = webdriver;
  return buildWebDriver();
};

/**
 * Create an express web server that serves the SDK setup code.
 * @returns {HTTPServer}
 */
export function createWebServer(): HTTPServer {
  const app: express.Application = express();
  app.use(express.static(join(__dirname, '..', '..', 'browser')));
  return createServer(app);
}
