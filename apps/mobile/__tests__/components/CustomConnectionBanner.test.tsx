import ReactTestRenderer from 'react-test-renderer';
import { CustomConnectionBanner } from '@/src/components';
import { useConnectionStore } from '@/src/store/connection.store';
import { CONNECTION_BANNER_DELAY_MS } from '@/src/utils/hooks/useConnectionBanner';
import { allText, render } from '@/test-utils';

const TEXT = 'Connection lost. Reconnecting…';
const status = (s: 'idle' | 'connecting' | 'connected' | 'disconnected') => ReactTestRenderer.act(async () => { useConnectionStore.getState().set(s); });
const wait = (ms: number) => ReactTestRenderer.act(async () => { jest.advanceTimersByTime(ms); });
const shown = (tree: Awaited<ReturnType<typeof render>>) => allText(tree).includes(TEXT);

beforeEach(() => {
  jest.useFakeTimers();
  useConnectionStore.setState({ status: 'connected' });
});
afterEach(() => jest.useRealTimers());

describe('connection banner', () => {
  it('shows nothing while connected, or when the socket is switched off on purpose', async () => {
    const tree = await render(<CustomConnectionBanner />);
    await wait(10_000);
    expect(shown(tree)).toBe(false);
    await status('idle');
    await wait(10_000);
    expect(shown(tree)).toBe(false);
  });

  it('appears only after the connection has been down for a moment, so a quick reconnect does not flash it', async () => {
    const tree = await render(<CustomConnectionBanner />);
    await status('disconnected');
    await wait(CONNECTION_BANNER_DELAY_MS - 1);
    expect(shown(tree)).toBe(false);
    await wait(2);
    expect(shown(tree)).toBe(true);
  });

  it('never appears when the connection is back before the delay is over', async () => {
    const tree = await render(<CustomConnectionBanner />);
    await status('disconnected');
    await wait(1500);
    await status('connected');
    await wait(5000);
    expect(shown(tree)).toBe(false);
  });

  it('disappears at once when the connection returns', async () => {
    const tree = await render(<CustomConnectionBanner />);
    await status('disconnected');
    await wait(CONNECTION_BANNER_DELAY_MS + 1);
    expect(shown(tree)).toBe(true);
    await status('connected');
    expect(shown(tree)).toBe(false);
  });

  it('stays steady while Socket.IO alternates between "connecting" and "disconnected" on every retry', async () => {
    const tree = await render(<CustomConnectionBanner />);
    await status('connecting');
    await wait(CONNECTION_BANNER_DELAY_MS + 1);
    expect(shown(tree)).toBe(true);
    await status('disconnected');
    expect(shown(tree)).toBe(true);
    await status('connecting');
    expect(shown(tree)).toBe(true);
  });
});
