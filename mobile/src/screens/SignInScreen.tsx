import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { TextField } from '../components/TextField';
import { colors, MIN_TOUCH, radius, spacing, text } from '../theme';

interface Props {
  /** Called with a valid, trimmed email and the password. Throw to show an error. */
  onSignIn: (email: string, password: string) => Promise<void>;
  onCreateAccount: () => void;
  onForgotPassword: () => void;
  /** Apple / Google buttons from the design. Off until social sign-in is built. */
  showSocial?: boolean;
  /** Why the user is back here, e.g. "Your session ended". Shown above the form. */
  notice?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sign in screen (design "02 Sign in"). */
export function SignInScreen({ onSignIn, onCreateAccount, onForgotPassword, showSocial = false, notice }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    // Check the easy things on the phone first; the server still checks everything again.
    const next: typeof errors = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length === 0) next.password = 'Enter your password.';
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Logo size={30} outer="#FFFFFF" inner="#FFFFFF" dot="#FFFFFF" />
          </View>
          <Text accessibilityRole="header" style={[text.title, styles.title]}>
            Welcome back
          </Text>
          <Text style={text.body}>Sign in to talk with your coach.</Text>
        </View>

        {showSocial && (
          <>
            <View style={styles.group}>
              <Button title="Continue with Apple" variant="dark" onPress={() => {}} />
              <Button title="Continue with Google" variant="outline" onPress={() => {}} />
            </View>
            <View style={styles.dividerRow}>
              <View style={styles.line} />
              <Text style={text.small}>or use email</Text>
              <View style={styles.line} />
            </View>
          </>
        )}

        <View style={styles.form}>
          {notice && !errors.form ? (
            <View accessibilityRole="alert" style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}
          {errors.form ? (
            <View accessibilityRole="alert" style={styles.banner}>
              <Text style={styles.bannerText}>{errors.form}</Text>
            </View>
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setErrors((e) => ({ ...e, email: undefined, form: undefined })); // typing clears old errors
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setErrors((e) => ({ ...e, password: undefined, form: undefined }));
            }}
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            labelRight={
              <Pressable accessibilityRole="link" onPress={onForgotPassword} hitSlop={8} style={styles.linkTouch}>
                <Text style={text.link}>Forgot password?</Text>
              </Pressable>
            }
          />
          <View style={styles.submit}>
            <Button title="Sign in" onPress={submit} loading={busy} />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Coach Connect?</Text>
          <Pressable accessibilityRole="link" onPress={onCreateAccount} style={styles.linkTouch}>
            <Text style={[text.link, styles.footerLink]}>Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: 76, paddingBottom: 40, gap: spacing.xxl },
  header: { gap: 10 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.logo,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: spacing.sm },
  group: { gap: spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.divider },
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
  banner: { backgroundColor: colors.errorTint, borderRadius: radius.control, padding: spacing.md },
  bannerText: { color: colors.errorInk, fontSize: 14 },
  notice: { backgroundColor: colors.warningTint, borderRadius: radius.control, padding: spacing.md },
  noticeText: { color: colors.warningInk, fontSize: 14 },
  linkTouch: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  footer: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 15, color: colors.inkSecondary },
  footerLink: { fontSize: 15 },
});
