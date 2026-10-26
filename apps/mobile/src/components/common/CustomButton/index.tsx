import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { COLORS, CONTROL_HEIGHT, RADIUS } from '@/src/constants';

import type { CustomButtonProps } from './interface';

/** The big rounded button used across the app. While `loading` it ignores taps. */
export function CustomButton({ title, onPress, variant = 'primary', loading = false, disabled = false }: CustomButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: pressed ? COLORS.primaryPressed : COLORS.primary },
        variant === 'outline' && { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
        inactive && styles.inactive,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? COLORS.ink : COLORS.onPrimary} />
      ) : (
        <Text style={[styles.label, variant === 'outline' && { color: COLORS.ink }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: CONTROL_HEIGHT,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: { opacity: 0.6 },
  label: { color: COLORS.onPrimary, fontSize: 16, fontWeight: '600' },
});
