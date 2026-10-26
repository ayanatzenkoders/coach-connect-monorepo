import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { authApi, Me } from '../api/authApi';
import { ApiError } from '../api/client';
import { withAuth } from '../api/withAuth';
import { useAuthStore } from '../auth/authStore';
import { Button } from '../components/Button';
import { colors, spacing, text } from '../theme';

/**
 * TEMPORARY signed-in screen. It exists so you can SEE the real API behaviour:
 * the profile comes from GET /auth/me, and the buttons trigger the token and sign-out flows.
 * It will be replaced by the real tabs (People, Messages, Calls, Profile).
 */
export function HomeScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const [me, setMe] = useState<Me | null>(null);
  const [lastRequest, setLastRequest] = useState('not run yet');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setMe(await withAuth((token) => authApi.me(token)));
      setLastRequest('GET /auth/me: OK');
    } catch (e) {
      setLastRequest(e instanceof ApiError ? `GET /auth/me: ${e.status} ${e.code}` : 'GET /auth/me: failed');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={text.title}>
        Hi {me?.name ?? '...'}
      </Text>

      <View style={styles.card}>
        <Row label="Email" value={me?.email} />
        <Row label="Role" value={me?.role} />
        <Row label="Email verified" value={me ? String(me.emailVerified) : undefined} />
        <Row label="Subscription" value={me ? (me.subscription?.status ?? 'none') : undefined} />
        <Row label="Can call" value={me ? String(me.canCall) : undefined} />
      </View>
      <Text style={text.small}>Last request: {lastRequest}</Text>

      <Button title="Reload profile" variant="outline" onPress={load} loading={busy} />
      {__DEV__ && (
        <Button
          title="Dev: expire my access token"
          variant="outline"
          onPress={() => {
            // Pretend the 15-minute token ran out. Press "Reload profile" next:
            // the app should refresh silently and still show your profile.
            useAuthStore.setState({ accessToken: 'expired-on-purpose' });
            setLastRequest('token spoiled; press Reload profile');
          }}
        />
      )}
      <Button title="Sign out" onPress={signOut} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={text.small}>{label}</Text>
      <Text style={styles.value}>{value ?? '...'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingTop: 76, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontSize: 15, color: colors.ink, fontWeight: '600' },
});
