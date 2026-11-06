import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomAvatar, CustomBackButton, CustomButton, MicIcon, MicOffIcon, PhoneIcon, SpeakerIcon, VideoIcon, VideoOffIcon } from '@/src/components';
import { COLORS, MAX_FONT_SCALE, SPACING } from '@/src/constants';
import type { VideoTile } from '@/src/service/call/callEngine';
import type { RootStackScreenProps } from '@/src/utils/types';
import { participantLabel } from '@/src/service/call/callUi';
import { useCallScreen } from './hook/useCallScreen';

type Props = RootStackScreenProps<'Call'>;

/** The call itself: who is in it, the timer, the video, and the buttons (mute, speaker, camera, hang up). */
const Call: React.FC<Props> = () => {
  const insets = useSafeAreaInsets();
  const c = useCallScreen();
  if (!c.call) return <View style={styles.screen} />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
      <View style={styles.top}>
        {/* Minimize: back to the chat. The call keeps going and the chat shows "Call in progress". */}
        <CustomBackButton label="Minimize call" onPress={c.minimize} color={COLORS.onPrimary} alignToEdge />
      </View>

      <View style={styles.who}>
        <CustomAvatar id={c.call.startedById} name={c.title} size={88} />
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.title} style={styles.title} numberOfLines={2}>
          {c.title}
        </Text>
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.status}>
          {c.status}
        </Text>
        {c.connection === 'lost' && <CustomButton title="Rejoin" variant="outline" onPress={c.rejoin} />}
      </View>

      {c.tiles.length > 0 && (
        <View style={styles.tiles}>
          {c.tiles.map((t) => (
            <Tile key={t.id} tile={t} />
          ))}
        </View>
      )}

      <ScrollView style={styles.people} contentContainerStyle={styles.peopleContent}>
        {c.call.participants.map((p) => (
          <View key={p.userId} style={styles.person}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.personName} numberOfLines={1}>
              {p.name}
              {p.userId === c.meId ? ' (you)' : ''}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.control} style={styles.personState}>
              {participantLabel(p)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <RoundButton label={c.muted ? 'Unmute' : 'Mute'} on={c.muted} onPress={c.toggleMute}>
          {c.muted ? <MicOffIcon color={COLORS.ink} size={26} /> : <MicIcon color={COLORS.onPrimary} size={26} />}
        </RoundButton>
        <RoundButton label={c.speakerOn ? 'Speaker off' : 'Speaker on'} on={c.speakerOn} onPress={c.toggleSpeaker}>
          <SpeakerIcon color={c.speakerOn ? COLORS.ink : COLORS.onPrimary} size={26} />
        </RoundButton>
        <RoundButton label={c.cameraOn ? 'Camera off' : 'Camera on'} on={c.cameraOn} onPress={c.toggleCamera}>
          {c.cameraOn ? <VideoIcon color={COLORS.ink} size={26} /> : <VideoOffIcon color={COLORS.onPrimary} size={26} />}
        </RoundButton>
        <Pressable accessibilityRole="button" accessibilityLabel="Hang up" onPress={c.hangUp} style={[styles.round, styles.hangUp]}>
          <PhoneIcon color={COLORS.onPrimary} size={28} />
        </Pressable>
      </View>
    </View>
  );
};

export default Call;

/** One control. `on` = highlighted (white) so you can see at a glance what is switched on. */
function RoundButton({ label, on, onPress, children }: { label: string; on: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress} style={[styles.round, on ? styles.roundOn : styles.roundOff]}>
      {children}
    </Pressable>
  );
}

/** One person's camera. LiveKit's native view draws the video, so it is loaded only when a video call needs it. */
function Tile({ tile }: { tile: VideoTile }) {
  const { VideoView } = require('@livekit/react-native') as typeof import('@livekit/react-native');
  return (
    <View style={styles.tile} accessibilityLabel={`${tile.isLocal ? 'Your' : `${tile.name}'s`} camera`}>
      <VideoView videoTrack={tile.track} style={styles.video} objectFit="cover" mirror={tile.isLocal} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ink, paddingHorizontal: SPACING.xl },
  top: { flexDirection: 'row' },
  who: { alignItems: 'center', gap: SPACING.sm, paddingTop: SPACING.lg },
  title: { fontSize: 26, fontWeight: '600', color: COLORS.onPrimary, textAlign: 'center' },
  status: { fontSize: 16, color: COLORS.divider },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: SPACING.lg, justifyContent: 'center' },
  tile: { width: 150, height: 200, borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.inkSecondary },
  video: { flex: 1 },
  people: { flex: 1, marginTop: SPACING.lg },
  peopleContent: { gap: SPACING.sm },
  person: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  personName: { flex: 1, fontSize: 16, color: COLORS.onPrimary },
  personState: { fontSize: 14, color: COLORS.divider },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.lg },
  round: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  roundOff: { backgroundColor: COLORS.inkSecondary },
  roundOn: { backgroundColor: COLORS.onPrimary },
  hangUp: { backgroundColor: COLORS.error, transform: [{ rotate: '135deg' }] },
});
