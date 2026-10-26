import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, CustomButton, CustomTextInput, CustomWrapper } from '@/src/components';
import { COLORS, MIN_TOUCH, RADIUS, SPACING, TEXT } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useForgotPassword } from './hook/useForgotPassword';

type Props = RootStackScreenProps<'ForgotPassword'>;

/** Forgot password, step 1: ask for the email address. (No design existed; styled like Sign in.) */
const ForgotPassword: React.FC<Props> = () => {
  const s = useForgotPassword();

  return (
    <CustomWrapper scroll keyboardAvoidingView topInset={false} contentStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to sign in" onPress={s.goBack} style={styles.back}>
        <BackIcon />
      </Pressable>

      <View style={styles.header}>
        <Text accessibilityRole="header" style={TEXT.title}>
          Forgot your password?
        </Text>
        <Text style={TEXT.body}>Enter your email and we will send you a 6-digit code to choose a new one.</Text>
      </View>

      <View style={styles.form}>
        <CustomTextInput
          label="Email"
          value={s.email}
          onChangeText={s.onChangeEmail}
          error={s.error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={s.submit}
        />
        {s.notFound ? (
          <View accessibilityRole="alert" style={styles.notFound}>
            <Text style={styles.notFoundText}>
              We could not find an account for <Text style={styles.notFoundEmail}>{s.notFound}</Text>.
            </Text>
            <CustomButton title="Create an account" variant="outline" onPress={() => s.createAccount(s.notFound!)} />
          </View>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <CustomButton title="Send code" onPress={s.submit} loading={s.busy} />
      </View>
    </CustomWrapper>
  );
};

export default ForgotPassword;

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.xl, paddingTop: 56, paddingBottom: 40, gap: SPACING.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: SPACING.sm },
  form: { gap: SPACING.lg },
  notFound: { backgroundColor: COLORS.warningTint, borderRadius: RADIUS.control, padding: SPACING.lg, gap: SPACING.md },
  notFoundText: { color: COLORS.warningInk, fontSize: 14, lineHeight: 20 },
  notFoundEmail: { fontWeight: '700' },
  bottom: { marginTop: 'auto' },
});
