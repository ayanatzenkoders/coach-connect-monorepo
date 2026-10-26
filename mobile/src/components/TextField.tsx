import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, CONTROL_HEIGHT, radius, text } from '../theme';

interface Props
  extends Pick<
    TextInputProps,
    'value' | 'onChangeText' | 'secureTextEntry' | 'keyboardType' | 'autoComplete' | 'autoCapitalize' | 'textContentType' | 'returnKeyType' | 'onSubmitEditing'
  > {
  label: string;
  /** Message shown under the field; also turns the border red. */
  error?: string;
  /** Extra element on the label row, e.g. a "Forgot password?" link. */
  labelRight?: React.ReactNode;
}

/** Label + input + error text. The border turns green while typing and red on error. */
export function TextField({ label, error, labelRight, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.error : focused ? colors.primary : colors.border;
  const borderWidth = error || focused ? 2 : 1;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={text.label}>{label}</Text>
        {labelRight}
      </View>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        placeholderTextColor={colors.inkMuted}
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  input: {
    height: CONTROL_HEIGHT,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
  },
  error: { color: colors.error, fontSize: 13 },
});
