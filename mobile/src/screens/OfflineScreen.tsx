import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, spacing, text } from '../theme';

/** We have a saved login but cannot reach the server. The user stays signed in; they just retry. */
export function OfflineScreen({ onRetry }: { onRetry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={[text.title, styles.title]}>
        You are offline
      </Text>
      <Text style={[text.body, styles.body]}>We cannot reach Coach Connect right now. Check your connection and try again.</Text>
      <Button
        title="Try again"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onRetry();
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  title: { fontSize: 28 },
  body: { marginBottom: spacing.sm },
});
