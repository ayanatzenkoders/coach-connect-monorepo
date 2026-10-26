import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TOUCH, SPACING, TEXT } from '@/src/constants';
import { CustomButton } from '@/src/components/common/CustomButton';
import { BackIcon } from '@/src/components/common/CustomIcon';
import { CustomOTPInput } from '@/src/components/common/CustomOTPInput';
import { CustomResendRow } from '@/src/components/common/CustomResendRow';
import CustomWrapper from '@/src/components/wrappers/CustomWrapper';
import { useCodeEntry } from './hook/useCodeEntry';
import type { CustomCodeEntryProps } from './interface';

/**
 * A full screen for typing an emailed 6-digit code: six boxes, a resend countdown, and a button
 * that appears once all six digits are in. Used for "verify your email" and "reset your password".
 */
export function CustomCodeEntry({ title, description, onSendCode, sendOnOpen, initialResendSeconds, onSubmit, submitLabel = 'Verify', onBack }: CustomCodeEntryProps) {
  const s = useCodeEntry({ onSendCode, sendOnOpen, initialResendSeconds, onSubmit });

  return (
    <CustomWrapper topInset={false} contentStyle={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
        <BackIcon />
      </Pressable>

      <View style={styles.header}>
        <Text accessibilityRole="header" style={TEXT.title}>
          {title}
        </Text>
        <Text style={TEXT.body}>{description}</Text>
      </View>

      <View>
        <Text style={[TEXT.label, styles.legend]}>Verification code</Text>
        <CustomOTPInput value={s.code} onChangeText={s.onChangeCode} invalid={s.invalid} disabled={s.busy} autoFocus inputRef={s.input} />
      </View>

      <CustomResendRow secondsLeft={s.secondsLeft} onResend={s.resend} />

      <View style={styles.bottom}>
        {/* Only offered once all six digits are typed. */}
        {s.complete ? <CustomButton title={submitLabel} onPress={s.submit} loading={s.busy} /> : null}
      </View>
    </CustomWrapper>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: 40, gap: SPACING.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: SPACING.sm },
  legend: { marginBottom: 10 },
  bottom: { marginTop: 'auto', minHeight: 52 },
});
