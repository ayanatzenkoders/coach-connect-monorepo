import { connectToRoom, leaveRoom } from '@/src/service/call/callEngine';
import { useCallStore } from '@/src/store/call.store';

/**
 * callEngine against a FAKE LiveKit: the other tests replace callEngine completely, which once hid a bug where every call
 * hung up on itself right after connecting. These run the real connect/leave logic.
 */
const fake = {
  rooms: [] as { connect: jest.Mock; disconnect: jest.Mock; localParticipant: { setMicrophoneEnabled: jest.Mock; setCameraEnabled: jest.Mock } }[],
  connect: (() => Promise.resolve()) as () => Promise<void>,
  micNeverStarts: false,
};

jest.mock('livekit-client', () => ({
  // RoomEvent.X is just the text "X"
  RoomEvent: new Proxy({}, { get: (_t, name) => String(name) }),
  LogLevel: { debug: 0 },
  setLogLevel: jest.fn(),
  Room: class {
    connect = jest.fn(() => fake.connect());
    disconnect = jest.fn().mockResolvedValue(undefined);
    localParticipant = { setMicrophoneEnabled: jest.fn(() => (fake.micNeverStarts ? new Promise<void>(() => undefined) : Promise.resolve())), setCameraEnabled: jest.fn().mockResolvedValue(undefined) };
    on() {
      return this;
    }
    constructor() {
      fake.rooms.push(this);
    }
  },
}));
jest.mock('@livekit/react-native', () => ({
  registerGlobals: jest.fn(),
  AndroidAudioTypePresets: { communication: {} },
  AudioSession: { configureAudio: jest.fn().mockResolvedValue(undefined), startAudioSession: jest.fn().mockResolvedValue(undefined), stopAudioSession: jest.fn().mockResolvedValue(undefined), selectAudioOutput: jest.fn() },
}));

beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  fake.rooms = [];
  fake.connect = () => Promise.resolve();
  fake.micNeverStarts = false;
  useCallStore.getState().reset();
  await leaveRoom();
  fake.rooms = [];
});
afterEach(() => jest.restoreAllMocks());

describe('connectToRoom (real logic, fake LiveKit)', () => {
  it('opens the room, turns the microphone on and says "connected" - and does NOT hang up on itself', async () => {
    await connectToRoom('wss://lk.example', 'pass', { video: false });
    const room = fake.rooms[0]!;
    expect(room.connect).toHaveBeenCalledWith('wss://lk.example', 'pass');
    expect(room.disconnect).not.toHaveBeenCalled();
    expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(room.localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    expect(useCallStore.getState().connection).toBe('connected');
  });

  it('video calls turn the camera on too', async () => {
    await connectToRoom('wss://lk.example', 'pass', { video: true });
    expect(fake.rooms[0]!.localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
    expect(useCallStore.getState().cameraOn).toBe(true);
  });

  it('hanging up while it is still connecting closes that room again and never says "connected"', async () => {
    let finish!: () => void;
    fake.connect = () => new Promise<void>((resolve) => (finish = resolve));
    const connecting = connectToRoom('wss://lk.example', 'pass', { video: false });
    await new Promise<void>((r) => setImmediate(() => r())); // let it reach room.connect()
    await leaveRoom(); // the user hung up
    finish();
    await connecting;
    const room = fake.rooms[0]!;
    expect(room.disconnect).toHaveBeenCalled();
    expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    expect(useCallStore.getState().connection).not.toBe('connected');
  });

  it('leaving a connected room disconnects it', async () => {
    await connectToRoom('wss://lk.example', 'pass', { video: false });
    await leaveRoom();
    expect(fake.rooms[0]!.disconnect).toHaveBeenCalled();
  });

  it('a microphone that never starts fails with MIC_FAILED instead of hanging on "Connecting"', async () => {
    jest.useFakeTimers();
    fake.micNeverStarts = true;
    const caught = connectToRoom('wss://lk.example', 'pass', { video: false }).catch((e: Error) => e);
    await jest.advanceTimersByTimeAsync(11_000);
    expect(await caught).toEqual(new Error('MIC_FAILED'));
    jest.useRealTimers();
  });
});
