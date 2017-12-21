import DMP from './dmp';
import WSClientTransport from './transport/websocket/client';

function getUrlParams(): Map<string, string> {
  const serializedParams: string = window.location.search.substring(1);
  return serializedParams.split('&').reduce((params, nvpair) => {
    const [ name, value ] = nvpair.split('=').map(decodeURIComponent);
    return params.set(name, value);
  }, new Map());
}

function loadSdk(url: string): Promise<void> {
  const script: any = document.createElement('script');
  script.src = url;
  document.body.appendChild(script);
  return new Promise(resolve => {
    script.onload = () => resolve();
  }).then(() => {});
}

(async () => {
  const urlParams: Map<string, string> = getUrlParams();
  const sdkUrl: string = urlParams.get('sdkUrl') as string;
  const wsUrl: string = urlParams.get('wsUrl') as string;
  const transport: WSClientTransport = new WSClientTransport(wsUrl);

  await transport.open();
  await loadSdk(sdkUrl);

  const dmp: DMP = new DMP(transport);
  dmp.sendEvent({ sdkVersion: window['Twilio']['Video']['version'] });

  dmp.on('request', (request: any) => {
    const { data: { ping } } = request;
    if (ping) {
      request.sendResponse({ pong: ping });
    }
  });
})();
