import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { videoTiles } from '@/src/service/call/callEngine';
import { useAuthStore } from '@/src/store/auth.store';
import { useCallStore } from '@/src/store/call.store';
import { callTitle, formatDuration } from '@/src/service/call/callUi';
import { useCallActions } from '@/src/service/call/useCallActions';

/** Everything the Call screen shows: who, how it is going, the timer, the video tiles and the buttons. */
export const useCallScreen = () => {
  const navigation = useNavigation();
  const meId = useAuthStore((s) => s.user?.id ?? '');
  const actions = useCallActions();
  const call = useCallStore((s) => s.active);
  const connection = useCallStore((s) => s.connection);
  const muted = useCallStore((s) => s.muted);
  const cameraOn = useCallStore((s) => s.cameraOn);
  const speakerOn = useCallStore((s) => s.speakerOn);
  const roomVersion = useCallStore((s) => s.roomVersion); // redraw the tiles when somebody joins or switches their camera

  // The call is over (I hung up, the other side did, a ban...): nothing to show here any more.
  useEffect(() => {
    if (!call && navigation.canGoBack()) navigation.goBack();
  }, [call, navigation]);

  // A clock that ticks once a second, only while the call is running.
  const answeredAt = call?.answeredAt ? new Date(call.answeredAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!answeredAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [answeredAt]);

  // What to say under the name.
  let status = '';
  if (!call) status = '';
  else if (connection === 'connecting') status = 'Connecting…';
  else if (connection === 'reconnecting') status = 'Reconnecting…';
  else if (connection === 'lost') status = 'Connection lost';
  else if (call.state === 'RINGING') status = 'Ringing…';
  else status = answeredAt ? formatDuration(now - answeredAt) : 'Connected';

  return {
    call,
    title: call ? callTitle(call, meId) : '',
    meId,
    status,
    connection,
    muted,
    cameraOn,
    speakerOn,
    video: call?.video ?? false,
    // Re-read on every `roomVersion`: the tiles come from the live LiveKit room, which is not React state.
    tiles: roomVersion >= 0 ? videoTiles() : [],
    minimize: () => navigation.goBack(),
    ...actions,
  };
};
