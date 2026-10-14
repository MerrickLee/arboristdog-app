import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAdaptiveLayout } from '../utils/adaptiveLayout';

export function useAdaptiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = getAdaptiveLayout(width - insets.left - insets.right, fontScale);
  return {
    ...layout,
    height,
    headerPaddingTop: layout.expanded ? 20 : insets.top + 12,
    footerPaddingBottom: layout.expanded ? 24 : Math.max(insets.bottom + 16, 24),
  };
}
