import { CSQ } from "@contentsquare/react-native-bridge";
import { useEffect } from "react";

const HEAP_ENVIRONMENT_ID = process.env.EXPO_PUBLIC_HEAP_ENVIRONMENT_ID || "";

export const initAnalytics = () => {
  if (!HEAP_ENVIRONMENT_ID) {
    console.warn("Heap Environment ID not found. Analytics will not be initialized.");
    return;
  }

  try {
    CSQ.configureProductAnalytics(HEAP_ENVIRONMENT_ID, {
      enableRNAutocapture: true,
      // baseUrl: "https://mh.ba.contentsquare.net", // Uncomment if EU hosted
    });
    CSQ.start();
    console.log("[Analytics] Heap initialized successfully");
  } catch (error) {
    console.error("[Analytics] Failed to initialize Heap:", error);
  }
};

/**
 * Track a custom event
 * @param eventName Name of the event
 * @param properties Optional properties associated with the event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  try {
    CSQ.trackEvent(eventName, properties);
  } catch (error) {
    console.error(`[Analytics] Failed to track event ${eventName}:`, error);
  }
};

/**
 * Identify a user
 * @param identity Unique string to identify the user (e.g. email or UUID)
 */
export const identifyUser = (identity: string) => {
  try {
    CSQ.trackIdentity(identity);
  } catch (error) {
    console.error("[Analytics] Failed to identify user:", error);
  }
};
