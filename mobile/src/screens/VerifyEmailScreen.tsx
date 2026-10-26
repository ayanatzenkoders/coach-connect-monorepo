import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { BackIcon } from '../components/icons';
import { colors, MIN_TOUCH, radius, spacing, text } from '../theme';

export const CODE_LENGTH = 6;

interface Props {
  email: string;
  /** Ask the server to email a code. Resolves with how many seconds until another can be requested. */
  onSendCode: () => Promise<{ resendAfterSeconds: number }>;
  /** Check the typed code. Throws an ApiError when it is wrong. */
  onVerify: (code: string) => Promise<void>;
  /** Back arrow: the account already exists, so this signs out. */
  onBack: () => void;
}

/** Verify email screen (design "04 Verify email"): six boxes, resend countdown, Verify button. */
export function VerifyEmailScreen({ email, onSendCode, onVerify, onBack }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  /** Ask for a code; the server may say "you asked a moment ago", which is fine. */
  const requestCode = useCallback(async () => {
    try {
      setSecondsLeft((await onSendCode()).resendAfterSeconds);
      setError(undefined);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CODE_COOLDOWN') {
        setSecondsLeft(Number(e.data.retryAfterSeconds) || 60);
      } else {
        setError(e instanceof Error ? e.message : 'Could not send the code.');
      }
    }
  }, [onSendCode]);

  // Ask once when the screen opens (sign-up already sent one, then the server just answers "wait").
  useEffect(() => {
    requestCode();
  }, [requestCode]);

  // After a wrong code, put the cursor back so the user can type again straight away.
  // (Done here, not in the catch block: the input is still disabled while the check runs.)
  useEffect(() => {
    if (!busy && error) input.current?.focus();
  }, [busy, error]);

  // Count down the "Resend in 0:42" label.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function verify(value: string) {
    if (value.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    try {
      await onVerify(value);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_CODE' && typeof e.data.attemptsLeft === 'number') {
        const left = e.data.attemptsLeft;
        setError(`That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
      } else {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  function onChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(undefined);
    if (digits.length === CODE_LENGTH) verify(digits); // submit as soon as the last digit is typed
  }

  const activeIndex = Math.min(code.length, CODE_LENGTH - 1);
  const canResend = secondsLeft <= 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
        <BackIcon />
      </Pressable>

      <View style={styles.header}>
        <Text accessibilityRole="header" style={text.title}>
          Check your email
        </Text>
        <Text style={text.body}>
          We sent a 6-digit code to <Text style={styles.email}>{email}</Text>. It expires in 10 minutes.
        </Text>
      </View>

      <View>
        <Text style={[text.label, styles.legend]}>Verification code</Text>
        <View style={styles.boxes}>
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const isActive = focused && i === activeIndex && !error;
            return (
              <View
                key={i}
                style={[styles.box, isActive && styles.boxActive, !!error && styles.boxError]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                <Text style={styles.digit}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
          {/* One real input sits invisibly over the boxes: it gives us the number keypad, paste, and iOS autofill. */}
          <TextInput
            ref={input}
            autoFocus
            accessibilityLabel="Verification code"
            value={code}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={CODE_LENGTH}
            editable={!busy}
            caretHidden
            style={styles.hiddenInput}
          />
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>

      <View style={styles.resendRow}>
        <Text style={styles.resendLabel}>Didn’t get it?</Text>
        <Pressable accessibilityRole="button" disabled={!canResend} onPress={requestCode} style={styles.resendTouch}>
          <Text style={[styles.resend, canResend && { color: colors.primary }]}>
            {canResend ? 'Resend code' : `Resend in ${mm}:${ss}`}
          </Text>
        </Pressable>
      </View>

      <View style={styles.bottom}>
        <Button title="Verify" onPress={() => verify(code)} loading={busy} />
        <Button
          title="Open mail app"
          variant="outline"
          onPress={() => Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:').catch(() => undefined)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 40, gap: spacing.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.sm },
  email: { color: colors.ink, fontWeight: '600' },
  legend: { marginBottom: 10 },
  boxes: { flexDirection: 'row', gap: spacing.sm },
  box: {
    flex: 1,
    height: 60,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderWidth: 2, borderColor: colors.primary },
  boxError: { borderWidth: 2, borderColor: colors.error },
  digit: { fontSize: 24, fontWeight: '600', color: colors.ink },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.015, color: 'transparent' },
  error: { color: colors.error, fontSize: 14, marginTop: 10 },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resendLabel: { fontSize: 15, color: colors.inkSecondary },
  resendTouch: { height: MIN_TOUCH, justifyContent: 'center' },
  resend: { fontSize: 15, fontWeight: '600', color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  bottom: { marginTop: 'auto', gap: spacing.md },
});
