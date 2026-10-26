import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { ApiError } from '../src/api/client';
import { RegisterScreen } from '../src/screens/RegisterScreen';

type Tree = ReactTestRenderer.ReactTestRenderer;
const byLabel = (tree: Tree, label: string): ReactTestInstance =>
  tree.root.find(
    (n) => n.props.accessibilityLabel === label && (typeof n.props.onPress === 'function' || typeof n.props.onChangeText === 'function'),
  );
const allText = (tree: Tree) => tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));
const type = (tree: Tree, label: string, value: string) => ReactTestRenderer.act(() => byLabel(tree, label).props.onChangeText(value));
const press = (tree: Tree, label: string) => ReactTestRenderer.act(() => byLabel(tree, label).props.onPress());

async function render() {
  const onRegister = jest.fn().mockResolvedValue(undefined);
  const onBack = jest.fn();
  let tree!: Tree;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<RegisterScreen onRegister={onRegister} onBack={onBack} />);
  });
  return { tree, onRegister, onBack };
}
async function fillValid(tree: Tree) {
  await type(tree, 'Full name', '  Sara Malik ');
  await type(tree, 'Email', ' sara@coachconnect.dev ');
  await type(tree, 'Password', 'longenough1');
}

describe('RegisterScreen', () => {
  it('shows the title and all three fields', async () => {
    const { tree } = await render();
    expect(allText(tree)).toContain('Create your account');
    for (const label of ['Full name', 'Email', 'Password', 'Create account']) expect(byLabel(tree, label)).toBeTruthy();
  });

  it('blocks submit and lists what is missing', async () => {
    const { tree, onRegister } = await render();
    await press(tree, 'Create account');
    expect(onRegister).not.toHaveBeenCalled();
    expect(allText(tree)).toEqual(
      expect.arrayContaining(['Enter your name.', 'Enter a valid email address.', 'Use at least 8 characters.']),
    );
  });

  it('rejects a 7-character password', async () => {
    const { tree, onRegister } = await render();
    await type(tree, 'Full name', 'Sara');
    await type(tree, 'Email', 'sara@coachconnect.dev');
    await type(tree, 'Password', '1234567');
    await press(tree, 'Create account');
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('submits trimmed name and email', async () => {
    const { tree, onRegister } = await render();
    await fillValid(tree);
    await press(tree, 'Create account');
    expect(onRegister).toHaveBeenCalledWith('Sara Malik', 'sara@coachconnect.dev', 'longenough1');
  });

  it('shows "email taken" under the email field', async () => {
    const { tree, onRegister } = await render();
    onRegister.mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.'));
    await fillValid(tree);
    await press(tree, 'Create account');
    expect(allText(tree)).toContain('An account with this email already exists.');
  });

  it('shows other failures (e.g. no internet) in a banner', async () => {
    const { tree, onRegister } = await render();
    onRegister.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.'));
    await fillValid(tree);
    await press(tree, 'Create account');
    expect(allText(tree)).toContain('Cannot reach the server.');
  });

  it('goes back to sign in', async () => {
    const { tree, onBack } = await render();
    await press(tree, 'Back to sign in');
    expect(onBack).toHaveBeenCalled();
  });
});
