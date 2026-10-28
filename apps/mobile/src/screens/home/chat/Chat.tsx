import React, { memo, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, CustomAvatar, CustomConnectionBanner, PhoneIcon, SendIcon } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, MESSAGE_MAX_LENGTH, MIN_TOUCH } from '@/src/constants';
import { useKeyboardVisible } from '@/src/utils/hooks/useKeyboardVisible';
import type { RootStackScreenProps } from '@/src/utils/types';
import { ChatItem, useChat } from './hook/useChat';

type Props = RootStackScreenProps<'Chat'>;

/** Screen 10: one chat. Newest message at the bottom; the list is "inverted" so it starts there. */
const Chat: React.FC<Props> = ({ route }) => {
  const insets = useSafeAreaInsets();
  const chat = useChat(route.params.chat);
  const meId = chat.meId;

  // The meta line under my newest message: "Sending…", "Failed", "Seen" or "Sent".
  const lastMine = [...chat.items].reverse().find((m) => m.senderId === meId);
  const metaFor = (m: ChatItem): string | null => {
    if (m.status === 'sending') return 'Sending…';
    if (m.status === 'failed') return 'Not sent. Tap to retry';
    if (m !== lastMine) return null;
    const seen = m.sequenceNumber !== undefined && chat.otherLastReadSequenceNumber >= m.sequenceNumber;
    // In a group, "seen" means everybody still in it has read the message.
    return seen ? (chat.isGroup ? 'Seen by all' : 'Seen') : 'Sent';
  };

  // The list is "inverted" (newest first, drawn from the bottom). Rebuilt only when the messages change,
  // so typing in the composer or opening the keyboard does not re-render every bubble.
  const listData = useMemo(() => [...chat.items].reverse(), [chat.items]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to messages" onPress={chat.goBack} style={styles.headerButton}>
          <BackIcon />
        </Pressable>
        {/* A group's name and avatar open its info (description and people). A direct chat's header is just the person. */}
        <Pressable
          accessibilityRole={chat.isGroup ? 'button' : undefined}
          accessibilityLabel={chat.isGroup ? `Group info for ${chat.title}` : undefined}
          disabled={!chat.isGroup}
          onPress={chat.openInfo}
          style={styles.who}>
          <CustomAvatar id={chat.other?.id ?? route.params.chat.id} name={chat.title} size={40} />
          <View style={styles.headerText}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.headerName} numberOfLines={1}>
              {chat.title}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.headerRole}>
              {chat.isGroup ? `${chat.memberCount} people` : chat.other?.role === 'COACH' ? 'Coach' : 'Member'}
            </Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Audio call" onPress={chat.call} style={styles.headerButton}>
          <PhoneIcon color={COLORS.primary} />
        </Pressable>
      </View>

      <CustomConnectionBanner />

      {chat.loading ? (
        <ActivityIndicator accessibilityLabel="Loading messages" color={COLORS.primary} style={styles.loader} />
      ) : (
        <FlatList
          inverted
          data={listData}
          keyExtractor={(m) => m.clientMessageId}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onEndReached={chat.loadOlder}
          onEndReachedThreshold={0.4}
          ListFooterComponent={chat.loadingOlder ? <ActivityIndicator color={COLORS.primary} style={styles.olderLoader} /> : undefined}
          ListEmptyComponent={
            <Text style={styles.empty} accessibilityLabel="No messages yet">
              {chat.isGroup ? 'Say hello to the group.' : `Say hello to ${chat.title.split(' ')[0]}.`}
            </Text>
          }
          renderItem={({ item, index }) => {
            const mine = item.senderId === meId;
            // The list is newest first, so the NEXT entry is the older message. In a group, other people's messages get their
            // name above the bubble, once per run of messages from the same person.
            const older = listData[index + 1];
            const senderName = chat.isGroup && !mine && older?.senderId !== item.senderId ? item.senderName : undefined;
            return <Bubble item={item} mine={mine} meta={metaFor(item)} senderName={senderName} onRetry={chat.retry} />;
          }}
        />
      )}

      {chat.canSend ? <Composer onSend={chat.send} /> : <ClosedNotice isGroup={chat.isGroup} name={chat.title} />}
    </KeyboardAvoidingView>
  );
};

export default Chat;

/**
 * Shown instead of the text box when nobody can write here: the other person was banned. The history above stays
 * readable. It goes away by itself if they are unbanned (the next refresh says `canSend` again).
 */
function ClosedNotice({ isGroup, name }: { isGroup: boolean; name: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="alert" style={[styles.closed, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.closedText}>
        {isGroup ? 'You cannot send messages here.' : `${name} is no longer available. You can read this chat but not reply.`}
      </Text>
    </View>
  );
}

/**
 * The text box and Send button. It owns the draft text AND the keyboard state, so a keystroke or the
 * keyboard opening re-renders only this small component, never the message list above it.
 */
function Composer({ onSend }: { onSend: (text: string) => void }) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0;
  // Home-indicator padding only while the keyboard is closed; with the keyboard open it would be an empty gap.
  const paddingBottom = keyboardVisible ? 10 : Math.max(insets.bottom, 10);

  const submit = () => {
    if (!canSend) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <View style={[styles.composer, { paddingBottom }]}>
      <TextInput
        accessibilityLabel="Message"
        value={draft}
        onChangeText={setDraft}
        placeholder="Message"
        placeholderTextColor={COLORS.inkMuted}
        multiline
        maxLength={MESSAGE_MAX_LENGTH}
        maxFontSizeMultiplier={MAX_FONT_SCALE.control}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={submit}
        style={[styles.send, !canSend && styles.sendOff]}>
        <SendIcon color={COLORS.onPrimary} size={20} />
      </Pressable>
    </View>
  );
}

const Bubble = memo(function BubbleRow({ item, mine, meta, senderName, onRetry }: { item: ChatItem; mine: boolean; meta: string | null; senderName?: string; onRetry: (clientMessageId: string) => void }) {
  const failed = item.status === 'failed';
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      {senderName ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.senderName} numberOfLines={1}>
          {senderName}
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel={failed ? 'Retry sending message' : undefined}
        disabled={!failed}
        onPress={() => onRetry(item.clientMessageId)}
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, item.status === 'sending' && styles.bubbleSending]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
      </Pressable>
      {meta && <Text style={[styles.meta, failed && styles.metaFailed]}>{meta}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingBottom: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  headerButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  headerRole: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  loader: { marginTop: 40 },
  olderLoader: { marginVertical: 12 },
  list: { paddingHorizontal: 16, paddingVertical: 12, gap: 6, flexGrow: 1 },
  // The list is flipped upside down, so the "empty" text is flipped too to read normally.
  empty: { textAlign: 'center', color: COLORS.inkSecondary, fontSize: 15, marginTop: 40, transform: [{ scaleY: -1 }] },
  row: { maxWidth: '82%', gap: 3 },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.divider, borderBottomLeftRadius: 4 },
  bubbleSending: { opacity: 0.6 },
  bubbleText: { fontSize: 15, lineHeight: 22, color: COLORS.ink },
  bubbleTextMine: { color: COLORS.onPrimary },
  meta: { fontSize: 12, color: COLORS.inkMuted },
  senderName: { fontSize: 12, fontWeight: '600', color: COLORS.primary, marginLeft: 4 },
  closed: { paddingHorizontal: 20, paddingTop: 14, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.divider },
  closedText: { fontSize: 14, lineHeight: 20, color: COLORS.inkSecondary, textAlign: 'center' },
  metaFailed: { color: COLORS.error, fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.divider },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: COLORS.ink, backgroundColor: COLORS.background },
  send: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
});
