import React from 'react';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { SignInScreen } from '../src/screens/SignInScreen';

type Tree = ReactTestRenderer.ReactTestRenderer;

// Finds the tappable / typeable element with this accessibility label.
const byLabel = (tree: Tree, label: string): ReactTestInstance =>
  tree.root.find(
    (n) =>
      n.props.accessibilityLabel === label &&
      (typeof n.props.onPress === 'function' || typeof n.props.onChangeText === 'function'),
  );

const allText = (tree: Tree) =>
  tree.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [n.props.children].flat().join(''));

async function render(props: Partial<React.ComponentProps<typeof SignInScreen>> = {}) {
  const onSignIn = jest.fn().mockResolvedValue(undefined);
  let tree!: Tree;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SignInScreen onSignIn={onSignIn} onCreateAccount={jest.fn()} onForgotPassword={jest.fn()} {...props} />,
    );
  });
  return { tree, onSignIn };
}

const type = (tree: Tree, label: string, value: string) =>
  ReactTestRenderer.act(() => byLabel(tree, label).props.onChangeText(value));
const press = (tree: Tree, label: string) => ReactTestRenderer.act(() => byLabel(tree, label).props.onPress());

describe('SignInScreen', () => {
  it('shows the welcome text, both fields and the sign in button', async () => {
    const { tree } = await render();
    const texts = allText(tree);
    expect(texts).toContain('Welcome back');
    expect(texts).toContain('Create an account');
    expect(byLabel(tree, 'Email')).toBeTruthy();
    expect(byLabel(tree, 'Password')).toBeTruthy();
    expect(byLabel(tree, 'Sign in')).toBeTruthy();
  });

  it('does not call the server when fields are empty, and shows what is wrong', async () => {
    const { tree, onSignIn } = await render();
    await press(tree, 'Sign in');
    expect(onSignIn).not.toHaveBeenCalled();
    expect(allText(tree)).toEqual(expect.arrayContaining(['Enter a valid email address.', 'Enter your password.']));
  });

  it('removes an old error as soon as the user edits that field', async () => {
    const { tree } = await render();
    await press(tree, 'Sign in'); // both fields empty: errors appear
    expect(allText(tree)).toContain('Enter a valid email address.');
    await type(tree, 'Email', 'sara@coachconnect.dev');
    expect(allText(tree)).not.toContain('Enter a valid email address.');
    expect(allText(tree)).toContain('Enter your password.'); // the other field's error stays
  });

  it('rejects an email without a domain', async () => {
    const { tree, onSignIn } = await render();
    await type(tree, 'Email', 'sara@');
    await type(tree, 'Password', 'x');
    await press(tree, 'Sign in');
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('submits a trimmed email and the password', async () => {
    const { tree, onSignIn } = await render();
    await type(tree, 'Email', '  sara@coachconnect.dev ');
    await type(tree, 'Password', 'Password123!');
    await press(tree, 'Sign in');
    expect(onSignIn).toHaveBeenCalledWith('sara@coachconnect.dev', 'Password123!');
  });

  it('shows the error message when sign in fails', async () => {
    const { tree, onSignIn } = await render();
    onSignIn.mockRejectedValue(new Error('Email or password is incorrect.'));
    await type(tree, 'Email', 'sara@coachconnect.dev');
    await type(tree, 'Password', 'wrong');
    await press(tree, 'Sign in');
    expect(allText(tree)).toContain('Email or password is incorrect.');
  });

  it('hides Apple and Google buttons until social sign-in exists', async () => {
    const hidden = await render();
    expect(allText(hidden.tree)).not.toContain('Continue with Apple');
    const shown = await render({ showSocial: true });
    expect(allText(shown.tree)).toContain('Continue with Apple');
  });
});
