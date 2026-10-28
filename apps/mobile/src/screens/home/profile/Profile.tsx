import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomButton } from '@/src/components';
import { COLORS, SPACING, MAX_FONT_SCALE, TEXT } from '@/src/constants';
import { useProfile } from './hook/useProfile';

/**
 * TEMPORARY profile screen. It exists so you can SEE the real API behaviour: the profile comes from
 * GET /auth/me, and the buttons trigger the token and sign-out flows. Replaced by the design's
 * "17 Profile & settings" later.
 */
const Profile: React.FC = () => {
  const p = useProfile();
  const me = p.me;
  const insets = useSafeAreaInsets();

  return (
    // Top padding follows the phone's notch / Dynamic Island, like the other tabs (a fixed number is wrong on some phones).
    <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={TEXT.title}>
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
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={TEXT.small}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.value}>
        {value ?? '...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingBottom: SPACING.xl, gap: SPACING.lg }, // 20 = the side margin of the other tabs
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.lg, gap: SPACING.md },
  // A long value (an email, or large system text) wraps inside the card instead of running over its edge.
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md },
  value: { flexShrink: 1, textAlign: 'right', fontSize: 15, color: COLORS.ink, fontWeight: '600' },
});
