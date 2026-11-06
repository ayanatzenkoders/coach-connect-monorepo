import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SPACING, TEXT } from '@/src/constants';
import { CustomButton } from '@/src/components/common/CustomButton';
import { CustomBackButton } from '@/src/components/common/CustomBackButton';
import { CustomOTPInput } from '@/src/components/common/CustomOTPInput';
import { CustomResendRow } from '@/src/components/common/CustomResendRow';
import CustomWrapper from '@/src/components/wrappers/CustomWrapper';
import { useCodeEntry } from './hook/useCodeEntry';
import type { CustomCodeEntryProps } from './interface';

/**
 * A full screen for typing an emailed 6-digit code: six boxes, a resend countdown, and a button
 * that appears once all six digits are in. Used for "verify your email" and "reset your password".
 */
export function CustomCodeEntry({ title, description, onSendCode, sendOnOpen, initialResendSeconds, onSubmit, onBack }: CustomCodeEntryProps) {
  const s = useCodeEntry({ onSendCode, sendOnOpen, initialResendSeconds, onSubmit });

  return (
    <CustomWrapper topInset={false} contentStyle={styles.container}>
      <CustomBackButton label="Back" onPress={onBack} alignToEdge />

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
        {s.complete ? <CustomButton title="Verify" onPress={s.submit} loading={s.busy} /> : null}
      </View>
    </CustomWrapper>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: 40, gap: SPACING.xl },
  header: { gap: SPACING.sm },
  legend: { marginBottom: 10 },
  bottom: { marginTop: 'auto', minHeight: 52 },
});
