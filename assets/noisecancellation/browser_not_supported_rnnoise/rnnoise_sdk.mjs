
const isSupported = () => {
  return false;
};

const getVersion = () => {
  return '0.6.0';
};


const noop = () => {
  return 0;
};

export default {
  init: noop,
  isInitialized: noop,
  connect: noop,
  isConnected: noop,
  disconnect: noop,
  enable: noop,
  isEnabled: noop,
  disable: noop,
  destroy: noop,
  setLogging: noop,
  getVersion,
  isSupported,
};

