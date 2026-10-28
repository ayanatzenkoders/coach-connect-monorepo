import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomAvatar, CustomButton } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, RADIUS, SPACING, TEXT } from '@/src/constants';
import { Membership, describeMembership } from './membership';
import { useProfile } from './hook/useProfile';

/** The Profile tab: who you are, your membership in plain words, and Sign out. Pull down to refresh. */
const Profile: React.FC = () => {
  const p = useProfile();
  const insets = useSafeAreaInsets();
  const isCoach = p.role === 'COACH';
  const membership = p.me ? describeMembership(p.me) : null;

  return (
    <ScrollView
      style={styles.flex}
      // Top padding follows the phone's notch / Dynamic Island, like the other tabs (a fixed number is wrong on some phones).
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={p.pulling} onRefresh={p.refresh} tintColor={COLORS.primary} />}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={TEXT.title}>
        Profile
      </Text>

      {/* Who I am: known at once, from the sign-in. */}
      <View style={styles.identity}>
        <CustomAvatar id={p.email} name={p.name} size={72} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.name} numberOfLines={2}>
          {p.name}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.email} numberOfLines={1}>
          {p.email}
        </Text>
        <Pill label={isCoach ? 'Coach' : 'Member'} tone="good" />
      </View>

      <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.sectionTitle}>
        Membership
      </Text>
      <View style={styles.card}>
        {membership ? (
          <>
            <Row title="Plan" detail={membership.detail} pill={<Pill label={membership.title} tone={membership.tone} />} />
            <Divider />
            <Row
              title="Calls"
              detail={p.me?.canCall ? (isCoach ? 'You can make and receive calls.' : 'You can start calls with coaches and members.') : 'Subscribe to start calls.'}
              pill={<Pill label={p.me?.canCall ? 'Allowed' : 'Not yet'} tone={p.me?.canCall ? 'good' : 'neutral'} />}
            />
          </>
        ) : p.failed ? (
          <View style={styles.problem}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.problemText}>
              We could not load your membership. Check your connection and try again.
            </Text>
            <CustomButton title="Try again" variant="outline" onPress={p.refresh} />
          </View>
        ) : (
          <View accessibilityLabel="Loading membership" style={styles.loading}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        )}
      </View>

      <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.sectionTitle}>
        Account
      </Text>
      <View style={styles.card}>
        <Row
          title="Email"
          detail={p.emailVerified ? 'Your email address is confirmed.' : 'Not confirmed yet. Check your inbox for the code.'}
          pill={<Pill label={p.emailVerified ? 'Verified' : 'Not verified'} tone={p.emailVerified ? 'good' : 'warn'} />}
        />
      </View>

      <CustomButton title="Sign out" variant="danger" onPress={p.confirmSignOut} />

      {__DEV__ && (
        <Pressable accessibilityRole="button" accessibilityLabel="Dev: expire my access token" onPress={p.expireToken} hitSlop={8} style={styles.dev}>
          <Text style={TEXT.small}>Developer: expire my access token</Text>
        </Pressable>
      )}
    </ScrollView>
  );
};

export default Profile;

const PILL_COLORS: Record<Membership['tone'], { bg: string; ink: string }> = {
  good: { bg: COLORS.primaryTint, ink: COLORS.primaryPressed },
  warn: { bg: COLORS.warningTint, ink: COLORS.warningInk },
  bad: { bg: COLORS.errorTint, ink: COLORS.error },
  neutral: { bg: COLORS.divider, ink: COLORS.inkSecondary },
};

/** A small coloured label: the one word you look for ("Active", "Verified"). */
function Pill({ label, tone }: { label: string; tone: Membership['tone'] }) {
  const { bg, ink } = PILL_COLORS[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={[styles.pillText, { color: ink }]}>
        {label}
      </Text>
    </View>
  );
}

/** A title and its explanation on the left, the status pill on the right. */
function Row({ title, detail, pill }: { title: string; detail: string; pill: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.rowTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.rowDetail}>
          {detail}
        </Text>
      </View>
      <View style={styles.pillSlot}>{pill}</View>
    </View>
  );
}

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 20, paddingBottom: SPACING.xl, gap: SPACING.lg }, // 20 = the side margin of the other tabs
  identity: { alignItems: 'center', gap: 6, paddingVertical: SPACING.sm },
  name: { fontSize: 22, fontWeight: '600', color: COLORS.ink, textAlign: 'center', marginTop: SPACING.sm },
  email: { fontSize: 15, color: COLORS.inkSecondary, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', color: COLORS.inkMuted, marginBottom: -SPACING.sm },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider, paddingHorizontal: SPACING.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  rowDetail: { fontSize: 14, lineHeight: 20, color: COLORS.inkSecondary },
  divider: { height: 1, backgroundColor: COLORS.divider },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.control },
  pillSlot: { alignSelf: 'flex-start' }, // in a row the pill lines up with the title, not the middle of the explanation
  pillText: { fontSize: 13, fontWeight: '600' },
  loading: { paddingVertical: SPACING.xl, alignItems: 'center' },
  problem: { paddingVertical: SPACING.lg, gap: SPACING.md },
  problemText: { fontSize: 14, lineHeight: 20, color: COLORS.inkSecondary },
  dev: { alignSelf: 'center', paddingVertical: SPACING.sm },
});
