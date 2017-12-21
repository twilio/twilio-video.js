import DockerBrowserDriver from './docker';
import SeleniumBrowserDriver from './selenium';

const BrowserDriver: typeof DockerBrowserDriver | typeof SeleniumBrowserDriver =
  'DOCKER_CHROME_AND_FIREFOX' in process.env
    ? DockerBrowserDriver
    : SeleniumBrowserDriver;

export default BrowserDriver;
