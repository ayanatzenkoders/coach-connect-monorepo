import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CustomAvatar, CustomButton, PhoneIcon } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, MIN_TOUCH, RADIUS, SPACING, TEXT } from '@/src/constants';
import type { ChatMemberInfo } from '@/src/service/api/chat.api';
import type { RootStackScreenProps } from '@/src/utils/types';
import { useGroupInfo } from './hook/useGroupInfo';

type Props = RootStackScreenProps<'GroupInfo'>;

/** Group info: the name, the description and everyone in the group (the coach first). */
const GroupInfo: React.FC<Props> = ({ route }) => {
  const insets = useSafeAreaInsets();
  const { chatId, title } = route.params;
  const g = useGroupInfo(chatId);

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={g.goBack} style={styles.back}>
          <BackIcon />
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.headerTitle}>
          Group info
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, SPACING.xl) }]}>
        <View style={styles.identity}>
          <CustomAvatar id={chatId} name={title} size={72} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={styles.title}>
            {g.detail?.title ?? title}
          </Text>
          {g.detail && (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={TEXT.small}>
              {g.detail.memberCount} people{g.createdBy ? ` · created by ${g.createdBy}` : ''}
            </Text>
          )}
        </View>

        <CustomButton title="Group call" variant="outline" onPress={g.call} />

        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Description
        </Text>
        <View style={styles.card}>
          {g.loading ? (
            <ActivityIndicator accessibilityLabel="Loading group" color={COLORS.primary} />
          ) : g.failed ? (
            <View style={styles.problem}>
              <Text style={styles.body}>We could not load this group.</Text>
              <CustomButton title="Try again" variant="outline" onPress={g.reload} />
            </View>
          ) : (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={g.detail?.description ? styles.body : styles.muted}>
              {g.detail?.description ?? 'No description.'}
            </Text>
          )}
        </View>

        {g.members.length > 0 && (
          <>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              People
            </Text>
            <View style={styles.card}>
              {g.members.map((m, i) => (
                <React.Fragment key={m.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <MemberRow member={m} isMe={m.id === g.meId} />
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* Only the creator manages the group. Adding needs room (the button hides at 6 people). */}
        {g.canAdd && <CustomButton title="Add people" variant="outline" onPress={g.addPeople} />}
        {g.canManage && <CustomButton title="Delete group" variant="danger" onPress={g.confirmDelete} loading={g.deleting} />}
      </ScrollView>
    </View>
  );
};

export default GroupInfo;

function MemberRow({ member, isMe }: { member: ChatMemberInfo; isMe: boolean }) {
  return (
    <View style={styles.member}>
      <CustomAvatar id={member.id} name={member.name} size={40} />
      <View style={styles.memberText}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.memberName} numberOfLines={1}>
          {member.name}
          {isMe ? ' (you)' : ''}
        </Text>
        {member.isBanned && (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.banned}>
            No longer available
          </Text>
        )}
      </View>
      <View style={[styles.pill, member.role === 'COACH' ? styles.pillCoach : styles.pillMember]}>
        {member.role === 'COACH' && <PhoneIcon color={COLORS.primaryPressed} size={12} />}
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.pillText}>
          {member.role === 'COACH' ? 'Coach' : 'Member'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingBottom: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.ink },
  content: { padding: 20, gap: SPACING.lg },
  identity: { alignItems: 'center', gap: 6, paddingVertical: SPACING.sm },
  title: { fontSize: 22, fontWeight: '600', color: COLORS.ink, textAlign: 'center', marginTop: SPACING.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', color: COLORS.inkMuted, marginBottom: -SPACING.sm },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.divider, padding: SPACING.lg },
  body: { fontSize: 15, lineHeight: 22, color: COLORS.ink },
  muted: { fontSize: 15, color: COLORS.inkMuted },
  problem: { gap: SPACING.md },
  divider: { height: 1, backgroundColor: COLORS.divider, marginVertical: SPACING.md },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberText: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  banned: { fontSize: 13, color: COLORS.error },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.control },
  pillCoach: { backgroundColor: COLORS.primaryTint },
  pillMember: { backgroundColor: COLORS.divider },
  pillText: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
});
