// Stub for @contentsquare/react-native-bridge
// Used when running in Expo Go (no native binary available)
const noop = () => {};
const noopAsync = () => Promise.resolve();

export const CSQ = {
  configureProductAnalytics: noop,
  start: noop,
  stop: noop,
  trackEvent: noop,
  trackIdentity: noop,
  trackScreen: noop,
  setUserConsentGranted: noop,
  setUserConsentDenied: noop,
};

export default { CSQ };
