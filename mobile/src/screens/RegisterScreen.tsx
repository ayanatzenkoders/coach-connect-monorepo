import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { BackIcon } from '../components/icons';
import { PasswordChecklist } from '../components/PasswordChecklist';
import { TextField } from '../components/TextField';
import { isStrongPassword } from '../auth/passwordRules';
import { showApiError } from '../toast/toastStore';
import { colors, MIN_TOUCH, spacing, text } from '../theme';

interface Props {
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  onBack: () => void;
  /** Email to start with (e.g. typed on the Forgot password screen). */
  initialEmail?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Create account screen (design "03 Create account"). */
export function RegisterScreen({ onRegister, onBack, initialEmail = '' }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  // Typing in a field removes that field's old error.
  const clear = (field: 'name' | 'email' | 'password') => setErrors((e) => ({ ...e, [field]: undefined }));

  async function submit() {
    const next: typeof errors = {};
    if (name.trim().length === 0) next.name = 'Enter your name.';
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!isStrongPassword(password)) next.password = 'Your password does not meet all the requirements below.';
    setErrors(next);
    if (next.name || next.email || next.password) return;

    setBusy(true);
    try {
      await onRegister(name.trim(), email.trim(), password);
    } catch (e) {
      showApiError(e); // "email already exists", no internet, ... all appear as a toast
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
            <PasswordChecklist password={password} />
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 40, gap: spacing.xl },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: spacing.sm },
  form: { gap: spacing.lg },
  bottom: { marginTop: 'auto', gap: spacing.lg },
  legal: { fontSize: 13, lineHeight: 20, color: colors.inkSecondary, textAlign: 'center' },
  legalLink: { fontWeight: '600', color: colors.ink },
});
