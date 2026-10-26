import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme';
import { CodeEntryScreen } from './CodeEntryScreen';

interface Props {
  email: string;
  /** Seconds until "Resend" works (the server said how long when it sent the first code). */
  initialResendSeconds?: number;
  /** Ask for a new code. */
  onResend: () => Promise<{ resendAfterSeconds: number }>;
  /** Check the code. When it is right, the app moves on to choosing a new password. */
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
}

/** Forgot password, screen 2 of 3: type the emailed code. */
export function ResetCodeScreen({ email, initialResendSeconds, onResend, onVerify, onBack }: Props) {
  return (
    <CodeEntryScreen
      title="Enter the code"
      description={
        <>
          We sent a 6-digit code to <Text style={styles.email}>{email}</Text>. It expires in 10 minutes.
        </>
      }
      initialResendSeconds={initialResendSeconds}
      onSendCode={onResend}
      onSubmit={onVerify}
      submitLabel="Verify"
      onBack={onBack}
    />
  );
}

const styles = StyleSheet.create({ email: { color: colors.ink, fontWeight: '600' } });
