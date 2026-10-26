import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { CustomCodeEntry } from '@/src/components';
import { COLORS } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useResetCode } from './hook/useResetCode';

type Props = RootStackScreenProps<'ResetCode'>;

/** Forgot password, screen 2 of 3: type the emailed code. */
const ResetCode: React.FC<Props> = ({ route }) => {
  const s = useResetCode(route.params);

  return (
    <CustomCodeEntry
      title="Enter the code"
      description={
        <>
          We sent a 6-digit code to <Text style={styles.email}>{s.email}</Text>. It expires in 10 minutes.
        </>
      }
      initialResendSeconds={s.resendSeconds}
      onSendCode={s.resend}
      onSubmit={s.verify}
      onBack={s.goBack}
    />
  );
};

export default ResetCode;

const styles = StyleSheet.create({ email: { color: COLORS.ink, fontWeight: '600' } });
