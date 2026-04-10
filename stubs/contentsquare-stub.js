/**
 * Contentsquare/Heap stub for Expo Go.
 *
 * In Expo Go the native @contentsquare/react-native-bridge module is not
 * available, so Metro resolves this stub instead.
 *
 * This stub forwards every analytics call to Heap's server-side REST API
 * using plain fetch(), which works in any JS environment including Expo Go.
 * When the app is compiled as a real dev/production build, the real native
 * CSQ SDK replaces this file and this code is never executed.
 */

const HEAP_TRACK_URL = 'https://heapanalytics.com/api/track';
const TAG = '[Heap]';

// Module-level state — persists for the lifetime of the JS bundle.
let _appId = '';

// Start with a random anonymous session ID so Heap accepts events before
// the user logs in. Replaced by the real Supabase UUID on login.
let _identity = 'anon-' + Math.random().toString(36).slice(2, 10);

// ─── internal ─────────────────────────────────────────────────────────────────

const post = (body) => {
  if (!_appId) return;

  fetch(HEAP_TRACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        console.warn(`${TAG} API error ${res.status}:`, text);
      } else {
        // Uncomment for verbose confirmation:
        // console.log(`${TAG} ✓ sent`);
      }
    })
    .catch((err) => console.warn(`${TAG} Network error:`, err.message));
};

const sendEvent = (event, properties = {}) => {
  console.log(`${TAG} → ${event}`, properties);
  post({
    app_id: _appId,
    identity: _identity,
    event,
    properties: properties ?? {},
    timestamp: new Date().toISOString(),
  });
};

// ─── CSQ public interface ─────────────────────────────────────────────────────

export const CSQ = {
  configureProductAnalytics(appId, options) {
    console.log(`${TAG} configure — app_id: ${appId}`);
    _appId = String(appId);
  },

  start() {
    console.log(`${TAG} started (Expo Go / REST mode)`);
  },

  stop() {},

  /** Map to POST /api/track */
  trackEvent(event, properties) {
    sendEvent(event, properties ?? {});
  },

  /** Heap has no separate screen endpoint — model as "Screen Viewed" event */
  trackScreen(screenName) {
    sendEvent('Screen Viewed', { screen_name: screenName });
  },

  /** Replace the anonymous identity with the real Supabase user UUID */
  trackIdentity(identity) {
    console.log(`${TAG} identity → ${identity}`);
    _identity = identity;
    // Fire an event to anchor this identity in the Heap session
    sendEvent('User Identified', { identity });
  },

  setUserConsentGranted() {},
  setUserConsentDenied() {},
};

export default { CSQ };
