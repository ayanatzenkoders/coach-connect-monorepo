import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomAvatar, PhoneIcon, VideoIcon } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, SPACING } from '@/src/constants';
import { useCallStore } from '@/src/store/call.store';
import { useCallActions } from '@/src/service/call/useCallActions';

/**
 * The ringing screen: it covers whatever the person is looking at (a chat, the tabs...) while somebody calls.
 * It disappears by itself when the call is answered elsewhere, canceled or times out (useCallSignals clears it).
 */
export function IncomingCallOverlay() {
  const insets = useSafeAreaInsets();
  const call = useCallStore(s => s.incoming);
  const actions = useCallActions();
  if (!call) return null;

  const group = call.participants.length > 2;
  return (
    <View
      accessibilityViewIsModal
      accessibilityRole="alert"
      style={[
        styles.cover,
        {
          paddingTop: insets.top + 60,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        },
      ]}
    >
      <View style={styles.who}>
        <CustomAvatar
          id={call.startedById}
          name={call.startedByName}
          size={104}
        />
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE.title}
          style={styles.name}
          numberOfLines={2}
        >
          {call.startedByName}
        </Text>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE.control}
          style={styles.kind}
        >
          {group
            ? `Group ${call.video ? 'video' : 'voice'} call`
            : `${call.video ? 'Video' : 'Voice'} call`}{' '}
          · ringing…
        </Text>
      </View>

      <View style={styles.buttons}>
        <View style={styles.choice}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decline call"
            onPress={() => actions.decline(call)}
            style={[styles.round, styles.decline]}
          >
            <PhoneIcon color={COLORS.onPrimary} size={30} />
          </Pressable>
          <Text style={styles.label}>Decline</Text>
        </View>
        <View style={styles.choice}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Accept call"
            onPress={() => actions.join(call)}
            style={[styles.round, styles.accept]}
          >
            {call.video ? (
              <VideoIcon color={COLORS.onPrimary} size={30} />
            ) : (
              <PhoneIcon color={COLORS.onPrimary} size={30} />
            )}
          </Pressable>
          <Text style={styles.label}>Accept</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // absoluteFill + a high zIndex: it sits on top of the navigator and swallows taps meant for the screen below.
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: COLORS.ink,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  who: { alignItems: 'center', gap: SPACING.md },
  name: {
    fontSize: 30,
    fontWeight: '600',
    color: COLORS.onPrimary,
    textAlign: 'center',
  },
  kind: { fontSize: 16, color: COLORS.divider },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
  },
  choice: { alignItems: 'center', gap: SPACING.sm },
  round: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: { backgroundColor: COLORS.error, transform: [{ rotate: '135deg' }] }, // the phone icon turned: "hang up"
  accept: { backgroundColor: COLORS.primary },
  label: { fontSize: 15, color: COLORS.onPrimary },
});
