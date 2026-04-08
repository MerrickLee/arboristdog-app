import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../../constants/theme';

interface ProgressDotsProps {
  current: number;
  total: number;
}

export const ProgressDots = ({ current, total }: ProgressDotsProps) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === current;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              {
                width: isActive ? 24 : 8,
                backgroundColor: isActive ? COLORS.leafAccent : 'rgba(255,255,255,0.3)',
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
