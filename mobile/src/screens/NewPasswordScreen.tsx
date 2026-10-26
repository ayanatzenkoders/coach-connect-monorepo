import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isStrongPassword } from '../auth/passwordRules';
import { Button } from '../components/Button';
import { BackIcon } from '../components/icons';
import { PasswordChecklist } from '../components/PasswordChecklist';
import { TextField } from '../components/TextField';
import { showApiError } from '../toast/toastStore';
import { colors, MIN_TOUCH, spacing, text } from '../theme';

interface Props {
  /** Save the new password. Throws (ApiError) if the server refuses; the error is shown as a toast. */
  onSubmit: (newPassword: string) => Promise<void>;
  onBack: () => void;
}

/** Forgot password, screen 3 of 3: choose the new password. */
export function NewPasswordScreen({ onSubmit, onBack }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isStrongPassword(password)) {
      setError('Your password does not meet all the requirements below.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(password);
    } catch (e) {
      showApiError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
          <BackIcon />
        </Pressable>

        <View style={styles.header}>
          <Text accessibilityRole="header" style={text.title}>
            Choose a new password
          </Text>
          <Text style={text.body}>Your code is correct. Now pick a new password for your account.</Text>
        </View>

        <View>
          <TextField
            label="New password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setError(undefined);
            }}
            error={error}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <PasswordChecklist password={password} />
        </View>

        <View style={styles.bottom}>
          <Text style={styles.note}>Resetting signs you out on every device.</Text>
          <Button title="Reset password" onPress={submit} loading={busy} />
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
  bottom: { marginTop: 'auto', gap: spacing.md },
  note: { fontSize: 13, color: colors.inkSecondary, textAlign: 'center' },
});
