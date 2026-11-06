import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, MAX_FONT_SCALE, SPACING } from '@/src/constants';
import { useCallStore } from '@/src/store/call.store';
import { connectedCount } from '@/src/service/call/callUi';
import { useCallActions } from '@/src/service/call/useCallActions';
import { useLiveCall } from '@/src/service/call/useLiveCall';

/**
 * The green strip under a chat's header while that chat has a call running:
 *  - I am not in it: "Call in progress · 2 in call · Join" (also for a call I missed or joined late)
 *  - I am in it but went back to the chat (minimized): "Return to call"
 * It disappears by itself when the call ends (useCallSignals empties the cache entry).
 */
export function CallBanner({ chatId }: { chatId: string }) {
  const call = useLiveCall(chatId);
  const activeId = useCallStore(s => s.active?.id);
  const actions = useCallActions();
  if (!call) return null;

  const mine = activeId === call.id;
  const count = connectedCount(call);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={mine ? 'Return to call' : 'Join call'}
      onPress={() => (mine ? actions.returnToCall() : actions.join(call))}
      style={styles.banner}
    >
      <View style={styles.text}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE.control}
          style={styles.title}
        >
          {call.video ? 'Video call' : 'Voice call'} in progress
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.sub}>
          {call.state === 'RINGING' ? 'Ringing…' : `${count} in call`}
        </Text>
      </View>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE.control}
        style={styles.action}
      >
        {mine ? 'Return' : 'Join'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: COLORS.onPrimary },
  sub: { fontSize: 13, color: COLORS.primaryTint },
  action: { fontSize: 15, fontWeight: '700', color: COLORS.onPrimary },
});
