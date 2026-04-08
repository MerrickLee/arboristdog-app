import React, { ReactNode } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../../constants/theme';

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'dark' | 'outline';
  style?: ViewStyle;
}

export const Button = ({ children, onPress, variant = 'primary', style }: ButtonProps) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          container: { backgroundColor: COLORS.leafAccent, borderWidth: 0 },
          text: { color: COLORS.white },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
          },
          text: { color: COLORS.white },
        };
      case 'dark':
        return {
          container: { backgroundColor: COLORS.canopyDark, borderWidth: 0 },
          text: { color: COLORS.white },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderColor: COLORS.almsteadGreen,
          },
          text: { color: COLORS.almsteadGreen },
        };
      default:
        return {
          container: { backgroundColor: COLORS.leafAccent, borderWidth: 0 },
          text: { color: COLORS.white },
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.button, vStyles.container, style]}
    >
      <Text style={[styles.text, vStyles.text]}>{children}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.32,
  },
});
