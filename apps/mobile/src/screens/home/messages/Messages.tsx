import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomAvatar, PlusIcon } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, TEXT } from '@/src/constants';
import type { ChatSummary } from '@/src/service/api/chat.api';
import { listTime } from '@/src/utils/helpers';
import { useMessages } from './hook/useMessages';

/** Screen 09: my chats, newest first, with the unread count. */
const Messages: React.FC = () => {
  const insets = useSafeAreaInsets();
  const m = useMessages();

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={TEXT.title}>
          Messages
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="New group" onPress={m.newGroup} hitSlop={6} style={styles.newGroup}>
          <PlusIcon color={COLORS.onPrimary} size={22} />
        </Pressable>
      </View>
      <FlatList
        data={m.items}
        keyExtractor={(c) => c.id}
        refreshing={false}
        onRefresh={m.refresh}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <Row chat={item} meId={m.meId} onPress={() => m.open(item)} />}
        ListEmptyComponent={
          m.loading ? (
            <ActivityIndicator accessibilityLabel="Loading messages" color={COLORS.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>Find a coach or a member in People and tap the chat button to start, or create a group with the + button.</Text>
            </View>
          )
        }
      />
    </View>
  );
};

export default Messages;

function Row({ chat: c, meId, onPress }: { chat: ChatSummary; meId: string; onPress: () => void }) {
  const unread = c.unreadCount > 0;
  const isGroup = c.type === 'GROUP';
  const last = c.lastMessage;
  // "You: hi" for my message; in a group the other person's first name comes first: "Amara: see you".
  const prefix = !last ? '' : last.senderId === meId ? 'You: ' : isGroup ? `${last.senderName.split(' ')[0]}: ` : '';
  const preview = last ? `${prefix}${last.body}` : isGroup ? 'No messages yet' : '';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={isGroup ? `Open group ${c.title}` : `Open chat with ${c.title}`} onPress={onPress} style={styles.row}>
      <CustomAvatar id={c.other?.id ?? c.id} name={c.title} size={52} />
      <View style={styles.rowText}>
        <View style={styles.line}>
          <Text style={[styles.name, unread && styles.bold]} numberOfLines={1}>
            {c.title}
          </Text>
          {c.lastMessageAt && <Text style={[styles.time, unread && styles.timeUnread]}>{listTime(c.lastMessageAt)}</Text>}
        </View>
        <View style={styles.line}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>
          {unread && (
            <View accessibilityLabel={`${c.unreadCount} unread`} style={styles.badge}>
              <Text style={styles.badgeText}>{c.unreadCount > 99 ? '99+' : c.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  newGroup: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 12, flexGrow: 1 },
  loader: { marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  bold: { fontWeight: '700' },
  time: { fontSize: 13, color: COLORS.inkMuted },
  timeUnread: { color: COLORS.primary, fontWeight: '600' },
  preview: { flex: 1, fontSize: 15, color: COLORS.inkSecondary },
  previewUnread: { color: COLORS.ink, fontWeight: '600' },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '700', color: COLORS.onPrimary },
  empty: { paddingVertical: 48, paddingHorizontal: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  emptyText: { fontSize: 14, color: COLORS.inkSecondary, textAlign: 'center' },
});
