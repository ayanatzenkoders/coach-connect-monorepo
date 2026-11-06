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
  // Android 12+: needed to route the call to a Bluetooth headset. A "no" is fine (the call just stays on the phone), so it never blocks.
  if (Number(Platform.Version) >= 31) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT).catch(() => undefined);
}

/**
 * LiveKit's code (browser-made) uses `DOMException` for timeouts and closed connections. React Native's engine has none, so the first
 * use ended in "Property 'DOMException' doesn't exist" and the call never connected. A tiny stand-in with the same name and message is enough.
 */
function ensureDomException() {
  const g = globalThis as { DOMException?: unknown };
  if (g.DOMException) return;
  class DOMExceptionShim extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  }
  g.DOMException = DOMExceptionShim;
}

const MIC_START_TIMEOUT_MS = 10_000;

/** Reject with `Error(code)` if `work` has not finished in `ms`. */
function withTimeout<T>(work: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(code)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Open the room with the pass the API gave us, then switch the microphone (and camera) on. */
export async function connectToRoom(url: string, token: string, options: { video: boolean }): Promise<void> {
  const store = useCallStore.getState();
  store.setConnection('connecting');
  await leaveRoom(); // never two rooms at once (this also raises `generation`, so take my ticket only AFTER it)
  const mine = ++generation; // if the number changes while I connect, somebody hung up (or started another call): see below

  await askAndroidPermissions(options.video);
  ensureDomException(); // before LiveKit is loaded: it looks DOMException up as soon as it runs
  // require(), not import(): Metro turns import() into a separate download that cannot find packages hoisted to the monorepo root.
  // A require() inside the function still loads LiveKit only when the first call starts, and it is in the normal bundle.
  const { AudioSession, AndroidAudioTypePresets, registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native');
  if (!globalsRegistered) {
    registerGlobals(); // gives React Native the WebRTC pieces (microphone, peer connection) LiveKit expects
    globalsRegistered = true;
  }
  // Only AFTER registerGlobals: livekit-client looks those WebRTC pieces up while it loads. Loaded first, it would not find them.
  const { Room, RoomEvent, setLogLevel, LogLevel } = require('livekit-client') as typeof import('livekit-client');
  if (__DEV__) setLogLevel(LogLevel.debug); // LiveKit's own step-by-step log (websocket, ICE candidates, why a connection failed)
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

  // Development only: show in the Metro/DevTools console what the room is doing. "Connected" but silent calls are diagnosed from these lines.
  if (__DEV__) {
    next
      .on(RoomEvent.SignalConnected, () => console.log('[call] signal (websocket) connected; now the audio connection (ICE)'))
      .on(RoomEvent.ConnectionStateChanged, (state) => console.log('[call] connection:', state))
      .on(RoomEvent.LocalTrackPublished, (pub) => console.log('[call] my track published:', pub.kind))
      .on(RoomEvent.TrackSubscribed, (track, _pub, who) => console.log('[call] hearing/seeing', who.identity, track.kind))
      .on(RoomEvent.AudioPlaybackStatusChanged, (ok) => console.log('[call] audio playback allowed:', ok))
      .on(RoomEvent.MediaDevicesError, (err) => console.warn('[call] microphone/camera error:', err));
  }

  if (__DEV__) console.log('[call] step 1: opening the room...');
  await next.connect(url, token);
  if (__DEV__) console.log('[call] step 2: room open, starting the microphone...');
  if (mine !== generation) {
    // The user hung up while we were still connecting: close this room again.
    await next.disconnect();
    return;
  }
  room = next;
  // A microphone that never starts (a native audio problem) must not leave the screen on "Connecting…" forever.
  await withTimeout(next.localParticipant.setMicrophoneEnabled(true), MIC_START_TIMEOUT_MS, 'MIC_FAILED');
  if (__DEV__) console.log('[call] step 3: microphone is on and publishing');
  if (options.video) await withTimeout(next.localParticipant.setCameraEnabled(true), MIC_START_TIMEOUT_MS, 'CAMERA_FAILED');
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
  const { AudioSession } = require('@livekit/react-native') as typeof import('@livekit/react-native');
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
  const { AudioSession } = require('@livekit/react-native') as typeof import('@livekit/react-native');
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
