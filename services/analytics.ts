import { CSQ } from "@contentsquare/react-native-bridge";

const HEAP_ENVIRONMENT_ID = process.env.EXPO_PUBLIC_HEAP_ENVIRONMENT_ID || "";
let analyticsEnabled = false;

export const initAnalytics = () => {
  if (!HEAP_ENVIRONMENT_ID) {
    console.warn("[Analytics] Heap Environment ID not found. Analytics disabled.");
    return;
  }

  try {
    CSQ.configureProductAnalytics(HEAP_ENVIRONMENT_ID, {
      enableRNAutocapture: true,
    });
    CSQ.start();
    analyticsEnabled = true;
    console.log("[Analytics] Heap initialized successfully");
  } catch (error) {
    console.error("[Analytics] Failed to initialize Heap:", error);
  }
};

/**
 * Track a named screen view.
 * Call this once per screen in a useEffect on mount.
 * @param screenName Human-readable screen name, e.g. "Capture", "Results"
 */
export const trackScreen = (screenName: string) => {
  if (!analyticsEnabled) return;
  try {
    CSQ.trackScreenview(screenName);
    console.log(`[Analytics] Screen: ${screenName}`);
  } catch (error) {
    console.error(`[Analytics] Failed to track screen ${screenName}:`, error);
  }
};

/**
 * Track a custom event with optional properties.
 * @param eventName  Descriptive event name, e.g. "photo_captured"
 * @param properties Optional key/value metadata
 */
export const trackEvent = (
  eventName: string,
  properties?: Record<string, any>
) => {
  if (!analyticsEnabled) return;
  try {
    CSQ.trackEvent(eventName, properties);
    console.log(`[Analytics] Event: ${eventName}`, properties ?? "");
  } catch (error) {
    console.error(`[Analytics] Failed to track event ${eventName}:`, error);
  }
};

/**
 * Identify the current user so events are attributed to them.
 * @param identity Unique string — use the Supabase user UUID.
 */
export const identifyUser = (identity: string) => {
  if (!analyticsEnabled) return;
  try {
    CSQ.identify(identity);
    console.log(`[Analytics] Identify: ${identity}`);
  } catch (error) {
    console.error("[Analytics] Failed to identify user:", error);
  }
};
