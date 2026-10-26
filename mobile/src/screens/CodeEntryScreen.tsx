import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { CODE_LENGTH, CodeInput } from '../components/CodeInput';
import { BackIcon } from '../components/icons';
import { ResendRow } from '../components/ResendRow';
import { useCountdown } from '../hooks/useCountdown';
import { showApiError } from '../toast/toastStore';
import { colors, MIN_TOUCH, spacing, text } from '../theme';

export { CODE_LENGTH };

interface Props {
  title: string;
  description: React.ReactNode;
  /** Ask the server to email a (new) code. Resolves with the seconds to wait before another can be requested. */
  onSendCode: () => Promise<{ resendAfterSeconds: number }>;
  /** True: ask for a code as soon as the screen opens. False: a code was already sent on the previous screen. */
  sendOnOpen?: boolean;
  /** When `sendOnOpen` is false: how long until "Resend" works. */
  initialResendSeconds?: number;
  /** Check the typed code. Throws (ApiError) when it is wrong; the error is shown as a toast. */
  onSubmit: (code: string) => Promise<void>;
  submitLabel?: string;
  onBack: () => void;
}

/**
 * A full screen for typing an emailed 6-digit code: six boxes, a resend countdown, and a button
 * that appears once all six digits are in. Used for "verify your email" and "reset your password".
 */
export function CodeEntryScreen({
  title,
  description,
  onSendCode,
  sendOnOpen = false,
  initialResendSeconds = 60,
  onSubmit,
  submitLabel = 'Verify',
  onBack,
}: Props) {
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false); // boxes turn red after a wrong code
  const [busy, setBusy] = useState(false);
  const { secondsLeft, start: startCountdown } = useCountdown();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  /** Ask for a code. "You asked a moment ago" is normal and silent: we only show the countdown. */
  const requestCode = useCallback(async () => {
    try {
      startCountdown((await onSendCode()).resendAfterSeconds);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CODE_COOLDOWN') startCountdown(Number(e.data.retryAfterSeconds) || 60);
      else showApiError(e);
    }
  }, [onSendCode, startCountdown]);

  // When the screen opens: either ask for a code, or just start the countdown for the one already sent.
  useEffect(() => {
    if (sendOnOpen) requestCode();
    else startCountdown(initialResendSeconds);
  }, [sendOnOpen, initialResendSeconds, requestCode, startCountdown]);

  // After a wrong code, put the cursor back so the user can type again straight away.
  // (Done here, not in the catch block: the input is still disabled while the check runs.)
  useEffect(() => {
    if (!busy && invalid) input.current?.focus();
  }, [busy, invalid]);

  async function submit() {
    if (code.length !== CODE_LENGTH) return;
    setBusy(true);
    try {
      await onSubmit(code);
    } catch (e) {
      showApiError(e);
      setInvalid(true);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    await requestCode();
    setCode('');
    setInvalid(false);
  }

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
        <BackIcon />
      </Pressable>

      <View style={styles.header}>
        <Text accessibilityRole="header" style={text.title}>
          {title}
        </Text>
        <Text style={text.body}>{description}</Text>
      </View>

      <View>
        <Text style={[text.label, styles.legend]}>Verification code</Text>
        <CodeInput
          value={code}
          onChangeText={(digits) => {
            setCode(digits);
            setInvalid(false);
          }}
          invalid={invalid}
          disabled={busy}
          autoFocus
          inputRef={input}
        />
      </View>

      <ResendRow secondsLeft={secondsLeft} onResend={resend} />

      <View style={styles.bottom}>
        {/* Only offered once all six digits are typed. */}
        {code.length === CODE_LENGTH ? <Button title={submitLabel} onPress={submit} loading={busy} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 40, gap: spacing.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.sm },
  legend: { marginBottom: 10 },
  bottom: { marginTop: 'auto', minHeight: 52 },
});
