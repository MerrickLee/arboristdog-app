import { useEffect } from 'react';
import { trackScreen } from '../services/analytics';

/**
 * Automatically tracks a screen view when the component mounts.
 * Drop this into any screen component with the screen name you want in Heap.
 *
 * @example
 *   export default function CaptureScreen() {
 *     useTrackScreen('Capture');
 *     ...
 *   }
 */
export function useTrackScreen(screenName: string) {
  useEffect(() => {
    trackScreen(screenName);
  }, [screenName]);
}
