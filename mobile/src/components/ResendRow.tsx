import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TOUCH } from '../theme';

/** "Didn't get it?  Resend in 0:42": the button only works when the countdown has reached zero. */
export function ResendRow({ secondsLeft, onResend }: { secondsLeft: number; onResend: () => void }) {
  const canResend = secondsLeft <= 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Didn’t get it?</Text>
      <Pressable accessibilityRole="button" disabled={!canResend} onPress={onResend} style={styles.touch}>
        <Text style={[styles.text, canResend && { color: colors.primary }]}>{canResend ? 'Resend code' : `Resend in ${mm}:${ss}`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 15, color: colors.inkSecondary },
  touch: { height: MIN_TOUCH, justifyContent: 'center' },
  text: { fontSize: 15, fontWeight: '600', color: colors.inkMuted, fontVariant: ['tabular-nums'] },
});
