import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme';
import { CODE_LENGTH, CodeEntryScreen } from './CodeEntryScreen';

export { CODE_LENGTH };

interface Props {
  email: string;
  /** Ask the server to email a code. Resolves with how many seconds until another can be requested. */
  onSendCode: () => Promise<{ resendAfterSeconds: number }>;
  /** Check the typed code. Throws an ApiError when it is wrong. */
  onVerify: (code: string) => Promise<void>;
  /** Back arrow: the account already exists, so this signs out. */
  onBack: () => void;
}

/** "Check your email" after sign-up (design "04 Verify email"). */
export function VerifyEmailScreen({ email, onSendCode, onVerify, onBack }: Props) {
  return (
    <CodeEntryScreen
      title="Check your email"
      description={
        <>
          We sent a 6-digit code to <Text style={styles.email}>{email}</Text>. It expires in 10 minutes.
        </>
      }
      sendOnOpen // sign-up already sent one; the server then answers "wait", which just starts the countdown
      onSendCode={onSendCode}
      onSubmit={onVerify}
      submitLabel="Verify"
      onBack={onBack}
    />
  );
}

const styles = StyleSheet.create({ email: { color: colors.ink, fontWeight: '600' } });
