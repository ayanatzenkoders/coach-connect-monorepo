import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, MAX_FONT_SCALE, RADIUS } from '@/src/constants';

import type { CustomSegmentedControlProps } from './interface';

/** Two or three equal segments in a grey track; the chosen one is white and lifted (People: Coaches | Members). */
export function CustomSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: CustomSegmentedControlProps<T>) {
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE.control}
              style={styles.label}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: RADIUS.control,
    backgroundColor: COLORS.surfaceMuted,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { fontSize: 15, fontWeight: '600', color: COLORS.ink },
});
