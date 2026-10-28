import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, CONTROL_HEIGHT, MAX_FONT_SCALE, MIN_TOUCH, RADIUS, TEXT } from '@/src/constants';
import { EyeIcon, EyeOffIcon } from '@/src/components/common/CustomIcon';

import type { CustomTextInputProps } from './interface';

/**
 * Label + input + error text. The border turns green while typing and red on error.
 * A password field (`secureTextEntry`) gets an eye button on the right: tap it to see what you typed, tap again to hide it.
 */
export function CustomTextInput({ label, error, secureTextEntry, ...inputProps }: CustomTextInputProps) {
  const [focused, setFocused] = useState(false);
  // Passwords start hidden. The screen only says "this is a password field"; showing it is the user's choice.
  const [hidden, setHidden] = useState(true);
  const isPassword = secureTextEntry === true;
  const borderColor = error ? COLORS.error : focused ? COLORS.primary : COLORS.border;
  const borderWidth = error || focused ? 2 : 1;

  // An email address is not a word: no spell-check squiggles, no autocorrect, no capital first letter.
  // (Placed before {...inputProps} so a screen can still override.)
  const emailDefaults = inputProps.keyboardType === 'email-address' ? { autoCorrect: false, spellCheck: false, autoCapitalize: 'none' as const } : undefined;

  return (
    <View style={styles.wrapper}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={TEXT.label}>
        {label}
      </Text>
      <View>
        <TextInput
          {...emailDefaults}
          {...inputProps}
          secureTextEntry={isPassword && hidden}
          accessibilityLabel={label}
          maxFontSizeMultiplier={MAX_FONT_SCALE.control} // the box has a fixed height, so its text cannot grow without limit
          placeholderTextColor={COLORS.inkMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, inputProps.multiline && styles.multiline, { borderColor, borderWidth, paddingLeft: 17 - borderWidth, paddingRight: isPassword ? MIN_TOUCH + 8 : 17 - borderWidth }]}
        />
        {isPassword ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} onPress={() => setHidden((h) => !h)} hitSlop={6} style={styles.eye}>
            {hidden ? <EyeIcon color={COLORS.inkMuted} size={22} /> : <EyeOffIcon color={COLORS.inkMuted} size={22} />}
          </Pressable>
        ) : null}
      </View>
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
  // A multi-line box (a description) grows instead of keeping the one-line height.
  multiline: { height: undefined, minHeight: CONTROL_HEIGHT * 1.7, maxHeight: 160, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' },
  // Centered on the box (its height is CONTROL_HEIGHT), over the right end of the input.
  eye: { position: 'absolute', right: 4, top: 0, width: MIN_TOUCH, height: CONTROL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  error: { color: COLORS.error, fontSize: 13 },
});
