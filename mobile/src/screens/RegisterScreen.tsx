import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { BackIcon, CheckIcon, DotIcon } from '../components/icons';
import { TextField } from '../components/TextField';
import { colors, MIN_TOUCH, radius, spacing, text } from '../theme';

interface Props {
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  onBack: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

/** Create account screen (design "03 Create account"). */
export function RegisterScreen({ onRegister, onBack }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const longEnough = password.length >= MIN_PASSWORD_LENGTH;
  // Typing in a field removes that field's old error.
  const clear = (field: 'name' | 'email' | 'password') => setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));

  async function submit() {
    const next: typeof errors = {};
    if (name.trim().length === 0) next.name = 'Enter your name.';
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!longEnough) next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    setErrors(next);
    if (next.name || next.email || next.password) return;

    setBusy(true);
    try {
      await onRegister(name.trim(), email.trim(), password);
    } catch (e) {
      // "This email is taken" belongs under the email field; anything else goes in a banner.
      if (e instanceof ApiError && e.code === 'EMAIL_TAKEN') setErrors({ email: e.message });
      else setErrors({ form: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to sign in" onPress={onBack} style={styles.back}>
          <BackIcon />
        </Pressable>

        <View style={styles.header}>
          <Text accessibilityRole="header" style={text.title}>
            Create your account
          </Text>
          <Text style={text.body}>Your coach will see your first name.</Text>
        </View>

        <View style={styles.form}>
          {errors.form ? (
            <View accessibilityRole="alert" style={styles.banner}>
              <Text style={styles.bannerText}>{errors.form}</Text>
            </View>
          ) : null}
          <TextField
            label="Full name"
            value={name}
            onChangeText={(v) => {
              setName(v);
              clear('name');
            }}
            error={errors.name}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clear('email');
            }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <View>
            <TextField
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                clear('password');
              }}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <View style={styles.hints}>
              <Hint ok={longEnough} label={`At least ${MIN_PASSWORD_LENGTH} characters`} />
              <Hint label="Not a password you use elsewhere" />
            </View>
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.legal}>
            By continuing you agree to the <Text style={styles.legalLink}>Terms</Text> and <Text style={styles.legalLink}>Privacy Policy</Text>.
          </Text>
          <Button title="Create account" onPress={submit} loading={busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** One line of the password checklist: a green tick when satisfied, a grey dot for plain advice. */
function Hint({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <View style={styles.hint}>
      {ok ? <CheckIcon /> : <DotIcon />}
      <Text style={[styles.hintText, ok && { color: colors.primaryPressed }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 40, gap: spacing.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.sm },
  form: { gap: spacing.lg },
  hints: { gap: 6, paddingTop: 10 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hintText: { fontSize: 14, color: colors.inkSecondary },
  banner: { backgroundColor: colors.errorTint, borderRadius: radius.control, padding: spacing.md },
  bannerText: { color: colors.errorInk, fontSize: 14 },
  bottom: { marginTop: 'auto', gap: spacing.lg },
  legal: { fontSize: 13, lineHeight: 20, color: colors.inkSecondary, textAlign: 'center' },
  legalLink: { fontWeight: '600', color: colors.ink },
});
