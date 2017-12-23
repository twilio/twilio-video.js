import DMP from './dmp';
import WSClientTransport from './transport/websocket/client';

function getUrlParams(): Map<string, string> {
  const serializedParams: string = window.location.search.substring(1);
  return serializedParams.split('&').reduce((params, nvpair) => {
    const [ name, value ] = nvpair.split('=').map(decodeURIComponent);
    return params.set(name, value);
  }, new Map());
}

async function loadScript(url: string): Promise<void> {
  const script: any = document.createElement('script');
  script.src = url;
  document.body.appendChild(script);
  await new Promise(resolve => script.onload = () => resolve());
}

/**
 * Initialize the browser's {@link DMP} client.
 * @returns {Promise<DMP>}
 */
export async function init(): Promise<DMP> {
  const urlParams: Map<string, string> = getUrlParams();
  const sdkUrl: string = urlParams.get('sdkUrl') as string;
  const wsUrl: string = urlParams.get('wsUrl') as string;
  const transport: WSClientTransport = new WSClientTransport(wsUrl);

  await loadScript(sdkUrl);
  await transport.open();
  return new DMP(transport);
}
