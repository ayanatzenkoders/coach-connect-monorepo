import { PermissionsAndroid, Platform } from 'react-native';
import type { Room, VideoTrack } from 'livekit-client';
import { useCallStore } from '@/src/store/call.store';

/**
 * The ONLY file that talks to LiveKit. The rest of the app calls these few functions and never imports LiveKit.
 * LiveKit is loaded with import() the first time a call starts, so the app opens as fast as before and people who
 * never call do not pay for it.
 *
 * The audio and video go straight from the phone to LiveKit. Our API is only asked for the pass (token) to get in.
 */

/** The room I am connected to (kept here, not in the store: it is not plain data). */
let room: Room | null = null;
/** Goes up on every connect/disconnect. A slow connect that is no longer wanted (the user already hung up) notices and stops. */
let generation = 0;
let globalsRegistered = false;

export interface VideoTile {
  id: string;
  name: string;
  isLocal: boolean;
  track: VideoTrack;
}

/** Android asks at run time (iOS asks by itself the first time the microphone starts, using the text in Info.plist). */
async function askAndroidPermissions(video: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  const wanted = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, ...(video ? [PermissionsAndroid.PERMISSIONS.CAMERA] : [])];
  const answers = await PermissionsAndroid.requestMultiple(wanted);
  if (wanted.some((p) => answers[p] !== PermissionsAndroid.RESULTS.GRANTED)) throw new Error('PERMISSION_DENIED');
}

/** Open the room with the pass the API gave us, then switch the microphone (and camera) on. */
export async function connectToRoom(url: string, token: string, options: { video: boolean }): Promise<void> {
  const mine = ++generation;
  const store = useCallStore.getState();
  store.setConnection('connecting');
  await leaveRoom(); // never two rooms at once

  await askAndroidPermissions(options.video);
  const { Room, RoomEvent } = await import('livekit-client');
  const { AudioSession, AndroidAudioTypePresets, registerGlobals } = await import('@livekit/react-native');
  if (!globalsRegistered) {
    registerGlobals(); // gives React Native the WebRTC pieces LiveKit expects
    globalsRegistered = true;
  }
  // Voice calls start on the earpiece, video calls on the speaker (like every calling app).
  await AudioSession.configureAudio({
    android: { preferredOutputList: options.video ? ['speaker', 'earpiece'] : ['earpiece', 'speaker'], audioTypeOptions: AndroidAudioTypePresets.communication },
    ios: { defaultOutput: options.video ? 'speaker' : 'earpiece' },
  });
  await AudioSession.startAudioSession();

  const next = new Room({ adaptiveStream: true, dynacast: true });
  const bump = () => useCallStore.getState().bump();
  next
    .on(RoomEvent.ParticipantConnected, bump)
    .on(RoomEvent.ParticipantDisconnected, bump)
    .on(RoomEvent.TrackSubscribed, bump)
    .on(RoomEvent.TrackUnsubscribed, bump)
    .on(RoomEvent.TrackMuted, bump)
    .on(RoomEvent.TrackUnmuted, bump)
    .on(RoomEvent.LocalTrackPublished, bump)
    .on(RoomEvent.LocalTrackUnpublished, bump)
    .on(RoomEvent.Reconnecting, () => useCallStore.getState().setConnection('reconnecting'))
    .on(RoomEvent.Reconnected, () => useCallStore.getState().setConnection('connected'))
    // We did not ask for this disconnect (our own leaveRoom() clears `room` first): the network or LiveKit gave up.
    .on(RoomEvent.Disconnected, () => {
      if (room === next) {
        room = null;
        useCallStore.getState().setConnection('lost');
      }
    });

  await next.connect(url, token);
  if (mine !== generation) {
    // The user hung up while we were still connecting: close this room again.
    await next.disconnect();
    return;
  }
  room = next;
  await next.localParticipant.setMicrophoneEnabled(true);
  if (options.video) await next.localParticipant.setCameraEnabled(true);
  store.setMuted(false);
  store.setCameraOn(options.video);
  store.setSpeakerOn(options.video);
  store.setConnection('connected');
}

/** Leave the room and let the phone's audio go back to normal. Safe to call when nothing is open. */
export async function leaveRoom(): Promise<void> {
  generation++;
  const old = room;
  room = null; // cleared first, so the "Disconnected" event above knows this one was on purpose
  if (!old) return;
  await old.disconnect().catch(() => undefined);
  const { AudioSession } = await import('@livekit/react-native');
  await AudioSession.stopAudioSession().catch(() => undefined);
}

export async function setMicrophone(on: boolean): Promise<void> {
  await room?.localParticipant.setMicrophoneEnabled(on);
  useCallStore.getState().setMuted(!on);
}

export async function setCamera(on: boolean): Promise<void> {
  await room?.localParticipant.setCameraEnabled(on);
  useCallStore.getState().setCameraOn(on);
}

/** Speaker on = loudspeaker, off = earpiece (or headphones if plugged in). */
export async function setSpeaker(on: boolean): Promise<void> {
  const { AudioSession } = await import('@livekit/react-native');
  await AudioSession.selectAudioOutput(Platform.OS === 'ios' ? (on ? 'force_speaker' : 'default') : on ? 'speaker' : 'earpiece');
  useCallStore.getState().setSpeakerOn(on);
}

/** Everybody whose camera is on right now (me included), for the video tiles. */
export function videoTiles(): VideoTile[] {
  if (!room) return [];
  const people = [room.localParticipant, ...room.remoteParticipants.values()];
  return people.flatMap((p) => {
    const camera = p.getTrackPublication('camera' as never);
    const track = camera && !camera.isMuted ? (camera.videoTrack as VideoTrack | undefined) : undefined;
    return track ? [{ id: p.identity, name: p.name || 'Someone', isLocal: p.isLocal, track }] : [];
  });
}
