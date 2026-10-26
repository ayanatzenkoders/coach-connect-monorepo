import React from 'react';
import { ApiError } from '../src/api/client';
import { NewPasswordScreen } from '../src/screens/NewPasswordScreen';
import { allText, clearToast, lastToast, press, render, typeInto } from '../test-utils';

async function setup() {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const onBack = jest.fn();
  const tree = await render(<NewPasswordScreen onSubmit={onSubmit} onBack={onBack} />);
  return { tree, onSubmit, onBack };
}

describe('NewPasswordScreen (forgot password, screen 3 of 3)', () => {
  beforeEach(clearToast);

  it('shows the four password rules', async () => {
    const { tree } = await setup();
    expect(allText(tree)).toEqual(expect.arrayContaining(['At least 8 characters', 'One lowercase letter', 'One uppercase letter', 'One number']));
  });

  it.each([
    ['no uppercase letter', 'alllowercase1'],
    ['no lowercase letter', 'ALLUPPERCASE1'],
    ['no number', 'NoNumbersHere'],
    ['too short', 'Ab1'],
  ])('does not submit a password with %s', async (_label, pw) => {
    const { tree, onSubmit } = await setup();
    await typeInto(tree, 'New password', pw);
    await press(tree, 'Reset password');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(allText(tree)).toContain('Your password does not meet all the requirements below.');
  });

  it('submits a strong password', async () => {
    const { tree, onSubmit } = await setup();
    await typeInto(tree, 'New password', 'Brand-new-pass-9');
    await press(tree, 'Reset password');
    expect(onSubmit).toHaveBeenCalledWith('Brand-new-pass-9');
  });

  it('shows a server refusal as a toast', async () => {
    const { tree, onSubmit } = await setup();
    onSubmit.mockRejectedValue(new ApiError(400, 'RESET_TOKEN_INVALID', 'This reset session has expired. Please start again.'));
    await typeInto(tree, 'New password', 'Brand-new-pass-9');
    await press(tree, 'Reset password');
    expect(lastToast()?.message).toBe('This reset session has expired. Please start again.');
  });

  it('the back arrow calls onBack', async () => {
    const { tree, onBack } = await setup();
    await press(tree, 'Back');
    expect(onBack).toHaveBeenCalled();
  });
});
