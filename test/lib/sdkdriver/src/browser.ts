import DMP from './dmp';
import WSClientTransport from './transport/websocket/client';

function getUrlParams(): Map<string, string> {
  const serializedParams: string = window.location.search.substring(1);
  return serializedParams.split('&').reduce((params, nvpair) => {
    const [name, value] = nvpair.split('=').map(decodeURIComponent);
    return params.set(name, JSON.parse(value));
  }, new Map());
}

async function loadScript(url: string): Promise<void> {
  const script = document.createElement('script');
  script.src = url;
  document.body.appendChild(script);
  await new Promise<void>(resolve => { script.onload = () => resolve(); });
}

/**
 * Initialize the browser's {@link DMP} client.
 * @returns {Promise<DMP>}
 */
export async function init(): Promise<DMP> {
  const urlParams: Map<string, any> = getUrlParams();
  const scripts: Array<string> = urlParams.get('scripts') as Array<string>;
  const wsUrl: string = urlParams.get('wsUrl') as string;
  const transport: WSClientTransport = new WSClientTransport(wsUrl);

  for (let script of scripts) {
    // eslint-disable-next-line no-await-in-loop
    await loadScript(script);
  }
  await transport.open();
  return new DMP(transport);
}
