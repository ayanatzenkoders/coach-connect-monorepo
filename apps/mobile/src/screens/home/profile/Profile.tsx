import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CustomButton } from '@/src/components';
import { COLORS, SPACING, TEXT } from '@/src/constants';
import { useProfile } from './hook/useProfile';

/**
 * TEMPORARY profile screen. It exists so you can SEE the real API behaviour: the profile comes from
 * GET /auth/me, and the buttons trigger the token and sign-out flows. Replaced by the design's
 * "17 Profile & settings" later.
 */
const Profile: React.FC = () => {
  const p = useProfile();
  const me = p.me;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={TEXT.title}>
        Hi {me?.name ?? '...'}
      </Text>

      <View style={styles.card}>
        <Row label="Email" value={me?.email} />
        <Row label="Role" value={me?.role} />
        <Row label="Email verified" value={me ? String(me.emailVerified) : undefined} />
        <Row label="Subscription" value={me ? (me.subscription?.status ?? 'none') : undefined} />
        <Row label="Can call" value={me ? String(me.canCall) : undefined} />
      </View>
      <Text style={TEXT.small}>Last request: {p.lastRequest}</Text>

      <CustomButton title="Reload profile" variant="outline" onPress={p.reload} loading={p.busy} />
      {__DEV__ && <CustomButton title="Dev: expire my access token" variant="outline" onPress={p.expireToken} />}
      <CustomButton title="Sign out" onPress={p.signOut} />
    </ScrollView>
  );
};

export default Profile;

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={TEXT.small}>{label}</Text>
      <Text style={styles.value}>{value ?? '...'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingTop: 76, gap: SPACING.lg },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.lg, gap: SPACING.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontSize: 15, color: COLORS.ink, fontWeight: '600' },
});
