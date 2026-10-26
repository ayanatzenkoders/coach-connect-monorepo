import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CustomButton, CustomLogo, CustomTextInput, CustomWrapper } from '@/src/components';
import { COLORS, MIN_TOUCH, RADIUS, SPACING, TEXT } from '@/src/constants';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useSignIn } from './hook/useSignIn';

type Props = RootStackScreenProps<'SignIn'>;

/** Sign in screen (design "02 Sign in"). */
const SignIn: React.FC<Props> = ({ route }) => {
  const s = useSignIn(route.params);

  return (
    <CustomWrapper scroll keyboardAvoidingView topInset={false} contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <CustomLogo size={30} outer="#FFFFFF" inner="#FFFFFF" dot="#FFFFFF" />
        </View>
        <Text accessibilityRole="header" style={[TEXT.title, styles.title]}>
          Welcome back
        </Text>
        <Text style={TEXT.body}>Sign in to talk with your coach.</Text>
      </View>

      <View style={styles.form}>
        {s.notice ? (
          <View accessibilityRole="alert" style={[styles.notice, s.notice.tone === 'success' && styles.noticeSuccess]}>
            <Text style={[styles.noticeText, s.notice.tone === 'success' && styles.noticeTextSuccess]}>{s.notice.text}</Text>
          </View>
        ) : null}
        <CustomTextInput
          label="Email"
          value={s.email}
          onChangeText={s.onChangeEmail}
          error={s.errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
        />
        <CustomTextInput
          label="Password"
          value={s.password}
          onChangeText={s.onChangePassword}
          error={s.errors.password}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={s.submit}
        />
        <Pressable accessibilityRole="link" accessibilityLabel="Forgot password?" onPress={s.goForgotPassword} hitSlop={8} style={styles.forgot}>
          <Text style={TEXT.link}>Forgot password?</Text>
        </Pressable>
        <CustomButton title="Sign in" onPress={s.submit} loading={s.busy} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to Coach Connect?</Text>
        <Pressable accessibilityRole="link" onPress={s.goRegister} style={styles.linkTouch}>
          <Text style={[TEXT.link, styles.footerLink]}>Create an account</Text>
        </Pressable>
      </View>
    </CustomWrapper>
  );
};

export default SignIn;

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.xl, paddingTop: 76, paddingBottom: 40, gap: SPACING.xxl },
  header: { gap: 10 },
  logo: { width: 44, height: 44, borderRadius: RADIUS.logo, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: SPACING.sm },
  form: { gap: SPACING.lg },
  forgot: { alignSelf: 'flex-end', minHeight: MIN_TOUCH, justifyContent: 'center', marginTop: -SPACING.sm },
  notice: { backgroundColor: COLORS.warningTint, borderRadius: RADIUS.control, padding: SPACING.md },
  noticeText: { color: COLORS.warningInk, fontSize: 14 },
  noticeSuccess: { backgroundColor: COLORS.primaryTint },
  noticeTextSuccess: { color: COLORS.primaryPressed },
  linkTouch: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  footer: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 15, color: COLORS.inkSecondary },
  footerLink: { fontSize: 15 },
});
