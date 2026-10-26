import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { CustomCodeEntry } from '@/src/components';
import { COLORS } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useVerifyEmail } from './hook/useVerifyEmail';

type Props = RootStackScreenProps<'VerifyEmail'>;

/** "Check your email" after sign-up (design "04 Verify email"). */
const VerifyEmail: React.FC<Props> = () => {
  const s = useVerifyEmail();

  return (
    <CustomCodeEntry
      title="Check your email"
      description={
        <>
          We sent a 6-digit code to <Text style={styles.email}>{s.email}</Text>. It expires in 10 minutes.
        </>
      }
      sendOnOpen // sign-up already sent one; the server then answers "wait", which just starts the countdown
      onSendCode={s.sendCode}
      onSubmit={s.verify}
      submitLabel="Verify"
      onBack={s.onBack}
    />
  );
};

export default VerifyEmail;

const styles = StyleSheet.create({ email: { color: COLORS.ink, fontWeight: '600' } });
