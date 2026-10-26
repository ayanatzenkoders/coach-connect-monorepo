import React from 'react';
import { TextInput } from 'react-native';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { ApiError } from '../src/api/client';
import { VerifyEmailScreen } from '../src/screens/VerifyEmailScreen';

type Tree = ReactTestRenderer.ReactTestRenderer;
const byLabel = (tree: Tree, label: string): ReactTestInstance =>
  tree.root.find(
    (n) => n.props.accessibilityLabel === label && (typeof n.props.onPress === 'function' || typeof n.props.onChangeText === 'function'),
  );
const allText = (tree: Tree) => tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));
const typeCode = (tree: Tree, v: string) => ReactTestRenderer.act(async () => byLabel(tree, 'Verification code').props.onChangeText(v));

async function render(overrides: Partial<React.ComponentProps<typeof VerifyEmailScreen>> = {}) {
  const mocks = {
    onSendCode: jest.fn().mockResolvedValue({ resendAfterSeconds: 60 }),
    onVerify: jest.fn().mockResolvedValue(undefined),
    onBack: jest.fn(),
  };
  const props = { email: 'sara@coachconnect.dev', ...mocks, ...overrides };
  let tree!: Tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<VerifyEmailScreen {...props} />);
  });
  return { tree, ...mocks, onSendCode: props.onSendCode as jest.Mock };
}

describe('VerifyEmailScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the email address and asks for a code once when it opens', async () => {
    const { tree, onSendCode } = await render();
    expect(allText(tree).join(' ')).toContain('sara@coachconnect.dev');
    expect(onSendCode).toHaveBeenCalledTimes(1);
  });

  /** Let `seconds` pass one second at a time, like a real clock (each tick re-renders and sets the next timer). */
  const tick = async (seconds: number) => {
    for (let i = 0; i < seconds; i++) {
      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
  };

  it('counts down before the code can be re-sent, then allows it', async () => {
    const { tree } = await render();
    expect(allText(tree)).toContain('Resend in 1:00');
    await tick(3);
    expect(allText(tree)).toContain('Resend in 0:57');
    await tick(57);
    expect(allText(tree)).toContain('Resend code');
  });

  it('uses the server wait time when a code was sent a moment ago', async () => {
    const { tree } = await render({
      onSendCode: jest.fn().mockRejectedValue(new ApiError(429, 'CODE_COOLDOWN', 'wait', { retryAfterSeconds: 42 })),
    });
    expect(allText(tree)).toContain('Resend in 0:42');
  });

  it('submits automatically after the sixth digit, ignoring non-digits', async () => {
    const { tree, onVerify } = await render();
    await typeCode(tree, '4821');
    expect(onVerify).not.toHaveBeenCalled();
    await typeCode(tree, '48 2-1 9 0');
    expect(onVerify).toHaveBeenCalledWith('482190');
  });

  it('shows how many tries are left after a wrong code and clears the boxes', async () => {
    const { tree, onVerify } = await render();
    onVerify.mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 4 }));
    await typeCode(tree, '111111');
    expect(allText(tree)).toContain('That code is not correct. 4 tries left.');
    expect(byLabel(tree, 'Verification code').props.value).toBe('');
  });

  it('puts the cursor back in the code field after a wrong code', async () => {
    const { tree, onVerify } = await render();
    onVerify.mockRejectedValue(new ApiError(400, 'INVALID_CODE', 'That code is not correct.', { attemptsLeft: 3 }));
    // Replace the input's focus() with a spy. The ref points at the real input, which is how the screen calls it.
    const input = tree.root.findByType(TextInput).instance as { focus: () => void };
    const focus = jest.fn();
    input.focus = focus;
    await typeCode(tree, '333333');
    expect(focus).toHaveBeenCalled();
  });

  it('shows the server message when the code expired or is locked', async () => {
    const { tree, onVerify } = await render();
    onVerify.mockRejectedValue(new ApiError(400, 'CODE_EXPIRED', 'That code has expired. Request a new one.'));
    await typeCode(tree, '222222');
    expect(allText(tree)).toContain('That code has expired. Request a new one.');
  });

  it('the Verify button asks for all six digits first', async () => {
    const { tree, onVerify } = await render();
    await typeCode(tree, '123');
    await ReactTestRenderer.act(async () => byLabel(tree, 'Verify').props.onPress());
    expect(onVerify).not.toHaveBeenCalled();
    expect(allText(tree)).toContain('Enter the 6-digit code.');
  });

  it('the back arrow calls onBack', async () => {
    const { tree, onBack } = await render();
    await ReactTestRenderer.act(async () => byLabel(tree, 'Back').props.onPress());
    expect(onBack).toHaveBeenCalled();
  });
});
