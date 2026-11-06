import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { callApi, type CallInfo, type CallSession } from '@/src/service/api/call.api';
import { connectToRoom, leaveRoom, setCamera, setMicrophone, setSpeaker } from '@/src/service/call/callEngine';
import { showApiError } from '@/src/service/setup/handleApiError';
import { withAuth } from '@/src/service/setup/withAuth';
import { useCallStore } from '@/src/store/call.store';
import { showToast } from '@/src/store/toast.store';

/**
 * Everything a person can DO in a call. Each action does three things in order:
 *  1. tell the server what I want (start / join / decline / leave): the server decides if it is allowed
 *  2. open or close my connection to the LiveKit room
 *  3. update what the screens show (the store)
 * What happens to the OTHER people comes back by itself over the socket (see useCallSignals).
 */
export const useCallActions = () => {
  const navigation = useNavigation();

  /** I am in the call now: remember it, open the call screen, connect the audio. */
  const enter = useCallback(
    async (session: CallSession) => {
      const store = useCallStore.getState();
      store.setIncoming(null);
      store.setActive(session.call);
      navigation.navigate('Call');
      try {
        await connectToRoom(session.livekit.url, session.livekit.token, { video: session.call.video });
      } catch (e) {
        // No microphone permission, no network, LiveKit down... Do not leave a ghost call behind: step out of it again.
        const denied = e instanceof Error && e.message === 'PERMISSION_DENIED';
        if (__DEV__) console.warn('[call] could not connect to the room:', e); // the toast is short on purpose; the real reason shows in Metro
        const micStuck = e instanceof Error && (e.message === 'MIC_FAILED' || e.message === 'CAMERA_FAILED');
        showToast(
          denied
            ? 'Allow the microphone (and camera for video) in Settings to join calls.'
            : micStuck
              ? 'The microphone (or camera) could not start on this phone. Close other apps that use it and try again.'
              : 'Could not connect the call. Check your connection and try again.',
        );
        useCallStore.getState().setActive(null);
        await leaveRoom();
        await withAuth((token) => callApi.leave(token, session.call.id)).catch(() => undefined);
      }
    },
    [navigation],
  );

  /** Start a call in a chat. If the chat already has one running, this joins it. */
  const start = useCallback(
    async (chatId: string, video: boolean) => {
      if (useCallStore.getState().active) return navigation.navigate('Call'); // already in a call: go back to it
      try {
        await enter(await withAuth((token) => callApi.start(token, { chatId, video })));
      } catch (e) {
        showApiError(e);
      }
    },
    [enter, navigation],
  );

  /** Answer a ringing call, or join one that is already running ("Call in progress" banner). */
  const join = useCallback(
    async (call: CallInfo) => {
      try {
        await enter(await withAuth((token) => callApi.join(token, call.id)));
      } catch (e) {
        useCallStore.getState().setIncoming(null);
        showApiError(e); // for example "This call has ended."
      }
    },
    [enter],
  );

  /** "No thanks". The overlay closes at once; the server is told in the background. */
  const decline = useCallback(async (call: CallInfo) => {
    useCallStore.getState().setIncoming(null);
    await withAuth((token) => callApi.decline(token, call.id)).catch(() => undefined);
  }, []);

  /** Hang up. While it still rings for the others this cancels it (the server decides which). */
  const hangUp = useCallback(async () => {
    const call = useCallStore.getState().active;
    if (!call) return;
    useCallStore.getState().setActive(null);
    await leaveRoom();
    await withAuth((token) => callApi.leave(token, call.id)).catch(() => undefined);
  }, []);

  /** The connection was lost but the call may still be running: ask for a new pass and connect again. */
  const rejoin = useCallback(async () => {
    const call = useCallStore.getState().active;
    if (!call) return;
    try {
      const session = await withAuth((token) => callApi.join(token, call.id));
      useCallStore.getState().setActive(session.call);
      await connectToRoom(session.livekit.url, session.livekit.token, { video: session.call.video });
    } catch (e) {
      showApiError(e);
    }
  }, []);

  /** Go back to the call screen of the call I am in (from the "Call in progress" banner). */
  const returnToCall = useCallback(() => navigation.navigate('Call'), [navigation]);

  return {
    start,
    join,
    decline,
    hangUp,
    rejoin,
    returnToCall,
    toggleMute: () => setMicrophone(useCallStore.getState().muted),
    toggleCamera: () => setCamera(!useCallStore.getState().cameraOn),
    toggleSpeaker: () => setSpeaker(!useCallStore.getState().speakerOn),
  };
};
