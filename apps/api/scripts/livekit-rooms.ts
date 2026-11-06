// Read-only look at your LiveKit project: are the keys valid, and (while a call is running) who is in which room and what they publish.
//   pnpm livekit:rooms
// Run it DURING a call. Each person should show an AUDIO track that is not muted. Changes nothing.
import 'dotenv/config';
import { RoomServiceClient } from 'livekit-server-sdk';

const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not all set in apps/api/.env');
  process.exit(1);
}

const client = new RoomServiceClient(LIVEKIT_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
try {
  const rooms = await client.listRooms();
  console.log(`Keys are valid. Rooms open right now: ${rooms.length}`);
  for (const room of rooms) {
    console.log(`\nROOM ${room.name}  (${room.numParticipants} in it)`);
    for (const p of await client.listParticipants(room.name)) {
      const tracks = p.tracks.map((t) => `${t.type === 0 ? 'AUDIO' : 'VIDEO'}${t.muted ? ' (muted)' : ''}`).join(', ') || 'NO TRACKS (nothing is being sent)';
      console.log(`  ${p.identity}  state=${p.state === 2 ? 'ACTIVE' : p.state}  sends: ${tracks}`);
    }
  }
} catch (e) {
  console.error('LiveKit refused or could not be reached:', e instanceof Error ? e.message : e);
  process.exit(1);
}
