import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { BackIcon } from '../components/icons';
import { TextField } from '../components/TextField';
import { showApiError } from '../toast/toastStore';
import { colors, MIN_TOUCH, radius, spacing, text } from '../theme';

interface Props {
  /** Ask the server to email a code. The next screen opens when this resolves. */
  onSubmit: (email: string) => Promise<void>;
  onBack: () => void;
  /** The email has no account: offer to create one (the email typed here is passed along). */
  onCreateAccount: (email: string) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Forgot password, step 1: ask for the email address. (No design existed; styled like Sign in.) */
export function ForgotPasswordScreen({ onSubmit, onBack, onCreateAccount }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  /** Set when the server says this email has no account. */
  const [notFound, setNotFound] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(email.trim());
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ACCOUNT_NOT_FOUND') setNotFound(email.trim());
      showApiError(e); // the server's message, as a toast
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
            Forgot your password?
          </Text>
          <Text style={text.body}>Enter your email and we will send you a 6-digit code to choose a new one.</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(undefined);
              setNotFound(null);
            }}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          {notFound ? (
            <View accessibilityRole="alert" style={styles.notFound}>
              <Text style={styles.notFoundText}>
                We could not find an account for <Text style={styles.notFoundEmail}>{notFound}</Text>.
              </Text>
              <Button title="Create an account" variant="outline" onPress={() => onCreateAccount(notFound)} />
            </View>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <Button title="Send code" onPress={submit} loading={busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 40, gap: spacing.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.sm },
  form: { gap: spacing.lg },
  notFound: { backgroundColor: colors.warningTint, borderRadius: radius.control, padding: spacing.lg, gap: spacing.md },
  notFoundText: { color: colors.warningInk, fontSize: 14, lineHeight: 20 },
  notFoundEmail: { fontWeight: '700' },
  bottom: { marginTop: 'auto' },
});
