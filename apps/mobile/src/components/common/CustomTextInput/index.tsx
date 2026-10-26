import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, CONTROL_HEIGHT, RADIUS, TEXT } from '@/src/constants';

import type { CustomTextInputProps } from './interface';

/** Label + input + error text. The border turns green while typing and red on error. */
export function CustomTextInput({ label, error, ...inputProps }: CustomTextInputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? COLORS.error : focused ? COLORS.primary : COLORS.border;
  const borderWidth = error || focused ? 2 : 1;

  return (
    <View style={styles.wrapper}>
      <Text style={TEXT.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        placeholderTextColor={COLORS.inkMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { borderColor, borderWidth, paddingHorizontal: 17 - borderWidth }]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  input: {
    height: CONTROL_HEIGHT,
    borderRadius: RADIUS.control,
    backgroundColor: COLORS.surface,
    color: COLORS.ink,
    fontSize: 16,
  },
  error: { color: COLORS.error, fontSize: 13 },
});
