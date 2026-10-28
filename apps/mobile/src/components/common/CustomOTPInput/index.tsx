import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CODE_LENGTH, COLORS, RADIUS, SPACING } from '@/src/constants';

import type { CustomOTPInputProps } from './interface';

/**
 * Six boxes for a verification code. The boxes are only drawing: ONE real (invisible) input sits
 * on top of them, which gives us the number keypad, paste, and iOS autofill of emailed codes.
 */
export function CustomOTPInput({ value, onChangeText, invalid = false, disabled = false, autoFocus = false, inputRef }: CustomOTPInputProps) {
  const [focused, setFocused] = useState(autoFocus);
  const activeIndex = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <View style={styles.boxes}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <View
          key={i}
          style={[styles.box, focused && i === activeIndex && !invalid && styles.boxActive, invalid && styles.boxError]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Text style={styles.digit}>{value[i] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        autoFocus={autoFocus}
        accessibilityLabel="Verification code"
        value={value}
        onChangeText={(raw) => onChangeText(raw.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={CODE_LENGTH}
        editable={!disabled}
        caretHidden
        style={styles.hiddenInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: SPACING.sm },
  box: {
    flex: 1,
    height: 60,
    borderRadius: RADIUS.control,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderWidth: 2, borderColor: COLORS.primary },
  boxError: { borderWidth: 2, borderColor: COLORS.error },
  digit: { fontSize: 24, fontWeight: '600', color: COLORS.ink },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.015, color: 'transparent' },
});
