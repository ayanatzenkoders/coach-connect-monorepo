import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, CONTROL_HEIGHT, radius } from '../theme';

type Variant = 'primary' | 'dark' | 'outline';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}

/** The big rounded button used across the app. While `loading` it ignores taps. */
export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false }: Props) {
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
        variant === 'primary' && { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        variant === 'dark' && { backgroundColor: colors.ink },
        variant === 'outline' && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
        inactive && styles.inactive,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.ink : colors.onPrimary} />
      ) : (
        <Text style={[styles.label, variant === 'outline' && { color: colors.ink }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: CONTROL_HEIGHT,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: { opacity: 0.6 },
  label: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
});
